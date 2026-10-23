import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  VERSION_AVISO,
  elegirReceptor,
  funcionPermitido,
  generarClaveOrganizador,
  generarCodigoCorreo,
  generarNumeroSorteo,
  limpiar,
  llaveNombre,
  normalizarClave,
  normalizarNumero,
  validarConfig,
  validarMonto, validarFecha,
  validarPersona,
  type Espacio,
  type Exclusion,
  type Persona,
} from './sorteo';
import type { Store } from './store';

export interface Invitado {
  espacio: string;
  nombreCompleto: string;
  edad: number;
  genero: string;
  correo: string;
  telefono: string;
  sinPromos: boolean;
  aviso: { version: string; en: number };
  deseos: string;
  registradoEn: number;
  /** Espacio al que le tocó regalar (solo existe una vez que sorteó; nunca vuelve a cambiar) */
  toca?: string;
  sorteadoEn?: number;
}

export interface Sorteo {
  numero: string;
  nombre: string;
  /** laymon = lo creó Laymon para un evento; personal = lo creó alguien por su cuenta */
  tipo: 'laymon' | 'personal';
  creadoEn: number;
  fecha: string;
  limite: number | null;
  organizador: Persona & { claveHash: string };
  espacios: Espacio[];
  exclusiones: Exclusion[];
  /** true desde el primer nombre sorteado: la lista y las reglas ya no se mueven */
  bloqueado: boolean;
  invitados: Record<string, Invitado>;
}

export type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; status: number };
const fallo = (status: number, error: string): { ok: false; error: string; status: number } => ({ ok: false, status, error });

type EnviarCorreo = (para: string, asunto: string, texto: string) => Promise<{ ok: boolean; detalle: string }>;

export interface DepsSorteo {
  store: Store;
  enviar: EnviarCorreo;
  /** Firma de sesiones y pimienta de códigos; sin ella el sorteo no abre */
  secreto: string | null;
  baseUrl: () => string;
  ahora?: () => number;
  azar?: (max: number) => number;
}

const K = {
  sorteo: (n: string) => `sorteo:${n}`,
  pendiente: (h: string) => `sorteo-pend:${h}`,
  limite: (h: string) => `sorteo-lim:${h}`,
  indice: 'sorteos-indice',
};
const VIDA_PENDIENTE_S = 15 * 60;
const VIDA_INVITADO_MS = 90 * 24 * 3600 * 1000;
const VIDA_ORGANIZADOR_MS = 12 * 3600 * 1000;

export type SorteoAlmacen = ReturnType<typeof crearSorteos>;

export function crearSorteos(deps: DepsSorteo) {
  const { store } = deps;
  const ahora = deps.ahora ?? Date.now;
  const pimienta = deps.secreto ?? 'sin-secreto';
  const sha = (x: string) => createHash('sha256').update(`${pimienta}|${x}`).digest('hex');

  // Un solo servidor atiende todo: una cola por sorteo evita que dos registros simultáneos se pisen.
  const colas = new Map<string, Promise<unknown>>();
  function conCandado<T>(llave: string, fn: () => Promise<T>): Promise<T> {
    const previa = colas.get(llave) ?? Promise.resolve();
    const siguiente = previa.then(fn, fn);
    colas.set(llave, siguiente.catch(() => undefined));
    return siguiente;
  }

  // ---------- Sesiones firmadas (sin guardar nada en el almacén) ----------
  const firmar = (cuerpo: string) => createHmac('sha256', pimienta).update(cuerpo).digest('base64url');
  function crearToken(datos: Record<string, string | number>): string {
    const c = Buffer.from(JSON.stringify(datos)).toString('base64url');
    return `${c}.${firmar(c)}`;
  }
  function leerToken(token: string | null | undefined): Record<string, string | number> | null {
    if (!deps.secreto || !token) return null;
    const [c, f] = token.split('.');
    if (!c || !f) return null;
    const esperada = Buffer.from(firmar(c));
    const recibida = Buffer.from(f);
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
    try {
      const d = JSON.parse(Buffer.from(c, 'base64url').toString()) as Record<string, string | number>;
      return typeof d.x === 'number' && d.x > ahora() ? d : null;
    } catch {
      return null;
    }
  }

  // ---------- Límites contra abuso (aproximados, suficientes para frenar correos en masa) ----------
  async function limitar(llave: string, max: number, ventanaS: number): Promise<boolean> {
    const k = K.limite(sha(llave));
    const t = ahora();
    const previos = ((await store.get<number[]>(k)) ?? []).filter((x) => t - x < ventanaS * 1000);
    if (previos.length >= max) return false;
    await store.set(k, [...previos, t], ventanaS);
    return true;
  }

  const cargar = async (numero: string) => store.get<Sorteo>(K.sorteo(normalizarNumero(numero)));
  const guardar = async (s: Sorteo) => store.set(K.sorteo(s.numero), s);
  const nombreDe = (s: Sorteo, id: string) => s.espacios.find((e) => e.id === id)?.nombre ?? '';

  // ---------- Códigos por correo ----------
  type TipoPendiente = 'crear' | 'registro' | 'entrar' | 'revelar';
  interface Pendiente {
    tipo: TipoPendiente;
    numero?: string;
    correo: string;
    codigoHash: string;
    intentos: number;
    creadoEn: number;
    datos?: unknown;
  }
  const llavePendiente = (tipo: TipoPendiente, numero: string | undefined, correo: string) => K.pendiente(sha(`${tipo}|${numero ?? ''}|${correo}`));

  async function mandarCodigo(tipo: TipoPendiente, numero: string | undefined, correo: string, datos: unknown, ip: string, titulo: string): Promise<Resultado<object>> {
    if (!(await limitar(`ip:${ip}`, 40, 3600))) return fallo(429, 'Demasiados intentos desde esta conexión. Vuelve a intentar en un rato.');
    const llave = llavePendiente(tipo, numero, correo);
    const previo = await store.get<Pendiente>(llave);
    if (previo && ahora() - previo.creadoEn < 60_000) return fallo(429, 'Ya te mandamos un código hace un momento. Revisa tu correo (y la carpeta de spam) o espera un minuto.');
    if (!(await limitar(`correo:${correo}`, 8, 3600))) return fallo(429, 'Ya pediste varios códigos para este correo. Intenta más tarde.');
    const codigo = generarCodigoCorreo(deps.azar);
    const r = await deps.enviar(
      correo,
      `Tu código de Laymon: ${codigo}`,
      `${titulo}\n\nTu código es: ${codigo}\n\nVale 15 minutos. Si tú no lo pediste, ignora este correo y no pasa nada.\n\nLaymon Pizzería Artesanal`,
    );
    if (!r.ok) {
      console.warn('[sorteo] no se pudo mandar el correo:', r.detalle);
      return fallo(502, 'No pudimos mandar el código a tu correo. Revisa que esté bien escrito e inténtalo en un momento.');
    }
    await store.set(llave, { tipo, numero, correo, codigoHash: sha(`codigo|${codigo}`), intentos: 0, creadoEn: ahora(), datos } satisfies Pendiente, VIDA_PENDIENTE_S);
    return { ok: true };
  }

  async function comprobarCodigo(tipo: TipoPendiente, numero: string | undefined, correo: string, codigo: string): Promise<Resultado<{ pendiente: Pendiente }>> {
    const llave = llavePendiente(tipo, numero, correo);
    const p = await store.get<Pendiente>(llave);
    if (!p) return fallo(400, 'Ese código ya venció. Pide uno nuevo.');
    if (p.intentos >= 5) {
      await store.del(llave);
      return fallo(400, 'Demasiados intentos. Pide un código nuevo.');
    }
    if (p.codigoHash !== sha(`codigo|${String(codigo).replace(/\D/g, '')}`)) {
      await store.set(llave, { ...p, intentos: p.intentos + 1 }, VIDA_PENDIENTE_S);
      return fallo(400, 'El código no es ese. Revísalo en tu correo.');
    }
    await store.del(llave);
    return { ok: true, pendiente: p };
  }

  const abrirSiHaySecreto = (): { ok: false; error: string; status: number } | null => (deps.secreto ? null : fallo(503, 'El sorteo todavía no está configurado en el servidor.'));

  // ---------- Crear sorteos ----------
  interface EntradaSorteo {
    nombre?: unknown;
    fecha?: unknown;
    limite?: unknown;
    nombres?: unknown;
    exclusiones?: unknown;
  }

  function armarSorteo(entrada: EntradaSorteo, organizador: Persona, tipo: Sorteo['tipo'], claveElegida?: string): Resultado<{ sorteo: Sorteo; clave: string }> {
    const nombre = limpiar(entrada.nombre, 60);
    if (!nombre) return fallo(400, 'Ponle un nombre a tu evento.');
    const config = validarConfig({ nombres: (entrada.nombres as never) ?? [], exclusiones: (entrada.exclusiones as never) ?? [] });
    if ('error' in config) return fallo(400, config.error);
    const limite = validarMonto(entrada.limite);
    if (limite !== null && typeof limite === 'object') return fallo(400, limite.error);
    const fecha = validarFecha(entrada.fecha, ahora());
    if (typeof fecha === 'object') return fallo(400, fecha.error);
    const clave = claveElegida ? normalizarClave(claveElegida) : generarClaveOrganizador(deps.azar);
    if (clave.length < 6) return fallo(400, 'La clave de organizador debe tener al menos 6 letras o números.');
    return {
      ok: true,
      clave,
      sorteo: {
        numero: generarNumeroSorteo(deps.azar),
        nombre,
        tipo,
        creadoEn: ahora(),
        fecha,
        limite: limite as number | null,
        organizador: { ...organizador, claveHash: sha(`clave|${clave}`) },
        espacios: config.espacios,
        exclusiones: config.exclusiones,
        bloqueado: false,
        invitados: {},
      },
    };
  }

  async function publicar(s: Sorteo): Promise<Sorteo> {
    while (await cargar(s.numero)) s.numero = generarNumeroSorteo(deps.azar);
    await guardar(s);
    await store.zadd(K.indice, s.creadoEn, s.numero);
    return s;
  }

  async function avisarCreacion(s: Sorteo, clave: string): Promise<void> {
    const enlace = `${deps.baseUrl()}/${s.numero}`;
    await deps
      .enviar(
        s.organizador.correo,
        `Tu sorteo "${s.nombre}" está listo`,
        `Hola ${s.organizador.nombreCompleto.split(' ')[0]},\n\nTu sorteo de intercambio está listo.\n\nNúmero de sorteo: ${s.numero}\nClave de organizador: ${clave}\nEnlace para tus invitados: ${enlace}\n\nMándales el enlace para que cada quien se registre y saque su nombre. Con tu clave entras a organizar en ${enlace}/organizador\n\nGuarda este correo: la clave solo se manda una vez.\n\nLaymon Pizzería Artesanal`,
      )
      .catch(() => undefined);
  }

  // ---------- Invitados ----------
  const sesionInvitado = (s: Sorteo, i: Invitado) => crearToken({ k: 'inv', n: s.numero, e: i.espacio, v: i.registradoEn, x: ahora() + VIDA_INVITADO_MS });

  async function invitadoDeToken(numero: string, token: string | null): Promise<Resultado<{ sorteo: Sorteo; invitado: Invitado }>> {
    const t = leerToken(token);
    const s = await cargar(numero);
    if (!t || t.k !== 'inv' || !s || t.n !== s.numero) return fallo(401, 'Tu sesión venció. Entra de nuevo con tu correo.');
    const i = s.invitados[String(t.e)];
    if (!i || i.registradoEn !== t.v) return fallo(401, 'Tu sesión venció. Entra de nuevo con tu correo.');
    return { ok: true, sorteo: s, invitado: i };
  }

  return {
    /** Lo que ve cualquiera con el número: nada de datos de personas */
    async infoPublica(numero: string): Promise<Resultado<{ nombre: string; fecha: string; limite: number | null; libres: Espacio[]; total: number; registrados: number }>> {
      const s = await cargar(numero);
      if (!s) return fallo(404, 'No encontramos un sorteo con ese número.');
      return {
        ok: true,
        nombre: s.nombre,
        fecha: s.fecha,
        limite: s.limite,
        libres: s.espacios.filter((e) => !s.invitados[e.id]),
        total: s.espacios.length,
        registrados: Object.keys(s.invitados).length,
      };
    },

    /** Crear un sorteo propio: paso 1, manda el código al correo del organizador */
    async iniciarCreacion(entrada: EntradaSorteo & { organizador?: Record<string, unknown> }, ip: string): Promise<Resultado<object>> {
      const sin = abrirSiHaySecreto();
      if (sin) return sin;
      const org = validarPersona(entrada.organizador);
      if ('error' in org) return fallo(400, org.error);
      const prueba = armarSorteo(entrada, org, 'personal');
      if (!prueba.ok) return prueba;
      return mandarCodigo('crear', undefined, org.correo, { entrada: { nombre: entrada.nombre, fecha: entrada.fecha, limite: entrada.limite, nombres: entrada.nombres, exclusiones: entrada.exclusiones }, org }, ip, 'Estás creando un sorteo de intercambio en Laymon.');
    },

    /** Paso 2: con el código se crea de verdad */
    async terminarCreacion(correo: string, codigo: string): Promise<Resultado<{ numero: string; clave: string; enlace: string; nombre: string }>> {
      const sin = abrirSiHaySecreto();
      if (sin) return sin;
      const c = limpiar(correo, 200).toLowerCase();
      const v = await comprobarCodigo('crear', undefined, c, codigo);
      if (!v.ok) return v;
      const { entrada, org } = v.pendiente.datos as { entrada: EntradaSorteo; org: Persona };
      const armado = armarSorteo(entrada, org, 'personal');
      if (!armado.ok) return armado;
      const s = await publicar(armado.sorteo);
      await avisarCreacion(s, armado.clave);
      return { ok: true, numero: s.numero, clave: armado.clave, enlace: `${deps.baseUrl()}/${s.numero}`, nombre: s.nombre };
    },

    /** Lo crea Laymon para un evento : sin código, la persona recibe número y clave */
    async crearParaEvento(entrada: EntradaSorteo & { organizador?: { nombre?: unknown; correo?: unknown; telefono?: unknown }; clave?: unknown }): Promise<Resultado<{ numero: string; clave: string; enlace: string }>> {
      const o = entrada.organizador ?? {};
      const org = validarPersona({ nombreCompleto: o.nombre, edad: 30, genero: 'Prefiero no decirlo', correo: o.correo, telefono: o.telefono, aviso: true });
      if ('error' in org) return fallo(400, org.error.replace('Escribe tu', 'Escribe el').replace('Ese correo', 'Ese correo del organizador'));
      const armado = armarSorteo(entrada, org, 'laymon', typeof entrada.clave === 'string' && entrada.clave.trim() ? entrada.clave : undefined);
      if (!armado.ok) return armado;
      const s = await publicar(armado.sorteo);
      return { ok: true, numero: s.numero, clave: armado.clave, enlace: `${deps.baseUrl()}/${s.numero}` };
    },

    /** Registro de un invitado, paso 1: elige su lugar en la lista y recibe un código */
    async registrar(numero: string, entrada: Record<string, unknown>, ip: string): Promise<Resultado<object>> {
      const sin = abrirSiHaySecreto();
      if (sin) return sin;
      const s = await cargar(numero);
      if (!s) return fallo(404, 'No encontramos un sorteo con ese número.');
      const persona = validarPersona(entrada);
      if ('error' in persona) return fallo(400, persona.error);
      const espacio = s.espacios.find((e) => e.id === entrada.espacio);
      if (!espacio) return fallo(400, 'Elige tu nombre en la lista.');
      if (s.invitados[espacio.id]) return fallo(409, 'Ese nombre ya se registró. Si eres tú, entra con tu correo.');
      if (Object.values(s.invitados).some((i) => i.correo === persona.correo)) return fallo(409, 'Ese correo ya está registrado en este sorteo. Entra con tu correo.');
      return mandarCodigo('registro', s.numero, persona.correo, { espacio: espacio.id, persona }, ip, `Te estás registrando en el sorteo "${s.nombre}".`);
    },

    /** Registro, paso 2 (o entrada de alguien ya registrado): con el código se abre la sesión */
    async verificarInvitado(numero: string, tipo: 'registro' | 'entrar', correo: string, codigo: string): Promise<Resultado<{ token: string }>> {
      const sin = abrirSiHaySecreto();
      if (sin) return sin;
      const n = normalizarNumero(numero);
      const c = limpiar(correo, 200).toLowerCase();
      return conCandado(n, async () => {
        const v = await comprobarCodigo(tipo, n, c, codigo);
        if (!v.ok) return v;
        const s = await cargar(n);
        if (!s) return fallo(404, 'No encontramos un sorteo con ese número.');
        if (tipo === 'entrar') {
          const i = Object.values(s.invitados).find((x) => x.correo === c);
          if (!i) return fallo(404, 'Ese correo no está registrado en este sorteo.');
          return { ok: true as const, token: sesionInvitado(s, i) };
        }
        const { espacio, persona } = v.pendiente.datos as { espacio: string; persona: Persona & { aviso?: boolean } };
        if (s.invitados[espacio]) return fallo(409, 'Alguien más se registró con ese nombre mientras tanto. Elige otro de la lista.');
        const i: Invitado = {
          espacio,
          nombreCompleto: persona.nombreCompleto,
          edad: persona.edad,
          genero: persona.genero,
          correo: persona.correo,
          telefono: persona.telefono,
          sinPromos: persona.sinPromos,
          aviso: { version: VERSION_AVISO, en: ahora() },
          deseos: '',
          registradoEn: ahora(),
        };
        s.invitados[espacio] = i;
        await guardar(s);
        return { ok: true as const, token: sesionInvitado(s, i) };
      });
    },

    /** Alguien que ya se registró pide su código para volver a entrar (la respuesta no revela si el correo existe) */
    async pedirEntrada(numero: string, correo: string, ip: string): Promise<Resultado<object>> {
      const sin = abrirSiHaySecreto();
      if (sin) return sin;
      const s = await cargar(numero);
      const c = limpiar(correo, 200).toLowerCase();
      if (!s) return fallo(404, 'No encontramos un sorteo con ese número.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return fallo(400, 'Ese correo no se ve bien.');
      if (Object.values(s.invitados).some((i) => i.correo === c)) return mandarCodigo('entrar', s.numero, c, null, ip, `Entras al sorteo "${s.nombre}".`);
      return { ok: true };
    },

    async estadoInvitado(numero: string, token: string | null) {
      const r = await invitadoDeToken(numero, token);
      if (!r.ok) return r;
      const { sorteo: s, invitado: i } = r;
      return {
        ok: true as const,
        numero: s.numero,
        evento: s.nombre,
        fecha: s.fecha,
        limite: s.limite,
        nombre: nombreDe(s, i.espacio),
        nombreCompleto: i.nombreCompleto,
        deseos: i.deseos,
        yaSorteo: Boolean(i.toca),
      };
    },

    async guardarDeseos(numero: string, token: string | null, deseos: unknown): Promise<Resultado<object>> {
      const n = normalizarNumero(numero);
      return conCandado(n, async () => {
        const r = await invitadoDeToken(n, token);
        if (!r.ok) return r;
        const texto = String(deseos ?? '').replace(/\r/g, '').split('\n').map((l) => l.trim().slice(0, 100)).filter(Boolean).slice(0, 8).join('\n');
        r.sorteo.invitados[r.invitado.espacio] = { ...r.invitado, deseos: texto };
        await guardar(r.sorteo);
        return { ok: true as const };
      });
    },

    /** Saca un nombre. Una sola vez: si ya sorteó, no cambia nada */
    async sortear(numero: string, token: string | null): Promise<Resultado<{ yaSorteo: true }>> {
      const n = normalizarNumero(numero);
      let aviso: (() => Promise<void>) | null = null;
      const r = await conCandado(n, async (): Promise<Resultado<{ yaSorteo: true }>> => {
        const v = await invitadoDeToken(n, token);
        if (!v.ok) return v;
        const { sorteo: s, invitado: i } = v;
        if (i.toca) return { ok: true, yaSorteo: true };
        const tomados = new Set(Object.values(s.invitados).map((x) => x.toca).filter(Boolean) as string[]);
        const pendientes = s.espacios.map((e) => e.id).filter((id) => !s.invitados[id]?.toca);
        const libres = s.espacios.map((e) => e.id).filter((id) => !tomados.has(id));
        const elegido = elegirReceptor(i.espacio, pendientes, libres, funcionPermitido(s.exclusiones), deps.azar);
        if (!elegido) return fallo(409, 'No pudimos cerrar tu sorteo con las reglas actuales. Avísale a tu organizador.');
        s.invitados[i.espacio] = { ...i, toca: elegido, sorteadoEn: ahora() };
        s.bloqueado = true;
        await guardar(s);
        aviso = () => avisarOrganizador(s, i.espacio);
        return { ok: true, yaSorteo: true };
      });
      if (r.ok && aviso) await (aviso as () => Promise<void>)().catch(() => undefined);
      return r;
    },

    /** El ojito: devuelve a quién le toca y su lista de deseos (solo a quien lo sorteó) */
    async revelar(numero: string, token: string | null) {
      const v = await invitadoDeToken(numero, token);
      if (!v.ok) return v;
      const { sorteo: s, invitado: i } = v;
      if (!i.toca) return fallo(409, 'Todavía no has sorteado tu nombre.');
      const otro = s.invitados[i.toca];
      return { ok: true as const, nombre: nombreDe(s, i.toca), deseos: otro?.deseos ?? '', registrado: Boolean(otro), limite: s.limite, fecha: s.fecha };
    },

    // ---------- Organizador ----------
    async entrarOrganizador(numero: string, clave: string, ip: string): Promise<Resultado<{ token: string }>> {
      const sin = abrirSiHaySecreto();
      if (sin) return sin;
      if (!(await limitar(`org:${ip}`, 15, 900))) return fallo(429, 'Demasiados intentos. Espera unos minutos.');
      const s = await cargar(numero);
      if (!s || s.organizador.claveHash !== sha(`clave|${normalizarClave(clave)}`)) return fallo(401, 'El número o la clave no coinciden.');
      return { ok: true, token: crearToken({ k: 'org', n: s.numero, v: s.organizador.claveHash.slice(0, 12), x: ahora() + VIDA_ORGANIZADOR_MS }) };
    },

    async estadoOrganizador(numero: string, token: string | null) {
      const r = await organizadorDeToken(numero, token);
      if (!r.ok) return r;
      const s = r.sorteo;
      const llavesSorteo = new Set(Object.values(s.invitados).filter((i) => i.toca).map((i) => i.espacio));
      return {
        ok: true as const,
        numero: s.numero,
        nombre: s.nombre,
        fecha: s.fecha,
        limite: s.limite,
        tipo: s.tipo,
        bloqueado: s.bloqueado,
        organizador: { nombre: s.organizador.nombreCompleto, correo: enmascarar(s.organizador.correo) },
        espacios: s.espacios.map((e) => ({ id: e.id, nombre: e.nombre, registrado: Boolean(s.invitados[e.id]), sorteo: llavesSorteo.has(e.id) })),
        exclusiones: s.exclusiones.map((x) => {
          const [de, a] = x.split('>');
          return { de, a };
        }),
        enlace: `${deps.baseUrl()}/${s.numero}`,
      };
    },

    /** Cambios del organizador. Antes del primer sorteo se puede todo; después solo nombre, fecha y límite */
    async configurar(numero: string, token: string | null, entrada: EntradaSorteo): Promise<Resultado<object>> {
      const n = normalizarNumero(numero);
      return conCandado(n, async () => {
        const r = await organizadorDeToken(n, token);
        if (!r.ok) return r;
        const s = r.sorteo;
        const nombre = entrada.nombre === undefined ? s.nombre : limpiar(entrada.nombre, 60);
        if (!nombre) return fallo(400, 'Ponle un nombre a tu evento.');
        const limite = entrada.limite === undefined ? s.limite : validarMonto(entrada.limite);
        if (limite !== null && typeof limite === 'object') return fallo(400, limite.error);
        const fecha = entrada.fecha === undefined ? s.fecha : validarFecha(entrada.fecha, ahora());
        if (typeof fecha === 'object') return fallo(400, fecha.error);
        s.nombre = nombre;
        s.limite = limite as number | null;
        s.fecha = fecha;
        if (entrada.nombres !== undefined || entrada.exclusiones !== undefined) {
          if (s.bloqueado) return fallo(409, 'Ya empezó el sorteo: la lista y las reglas no se pueden mover.');
          const actuales = s.espacios.map((e) => ({ id: e.id, nombre: e.nombre }));
          const config = validarConfig(
            { nombres: (entrada.nombres as never) ?? actuales, exclusiones: (entrada.exclusiones as never) ?? s.exclusiones.map((x) => ({ de: x.split('>')[0], a: x.split('>')[1] })) },
            s.espacios,
          );
          if ('error' in config) return fallo(400, config.error);
          const ids = new Set(config.espacios.map((e) => e.id));
          const quitado = Object.keys(s.invitados).find((id) => !ids.has(id));
          if (quitado) return fallo(409, `${nombreDe(s, quitado)} ya se registró. Primero libera su lugar y luego quítalo de la lista.`);
          s.espacios = config.espacios;
          s.exclusiones = config.exclusiones;
        }
        await guardar(s);
        return { ok: true as const };
      });
    },

    /** Libera el lugar de alguien que se registró con el nombre equivocado (si todavía no sortea) */
    async liberar(numero: string, token: string | null, espacio: string): Promise<Resultado<object>> {
      const n = normalizarNumero(numero);
      return conCandado(n, async () => {
        const r = await organizadorDeToken(n, token);
        if (!r.ok) return r;
        const i = r.sorteo.invitados[espacio];
        if (!i) return fallo(404, 'Ese lugar no tiene a nadie registrado.');
        if (i.toca) return fallo(409, 'Esa persona ya sorteó su nombre; ya no se puede liberar.');
        delete r.sorteo.invitados[espacio];
        await guardar(r.sorteo);
        return { ok: true as const };
      });
    },

    /** Ver quién le regala a quién exige un código nuevo al correo del organizador */
    async pedirCodigoRevelar(numero: string, token: string | null, ip: string): Promise<Resultado<object>> {
      const r = await organizadorDeToken(numero, token);
      if (!r.ok) return r;
      return mandarCodigo('revelar', r.sorteo.numero, r.sorteo.organizador.correo, null, ip, `Vas a ver quién le regala a quién en "${r.sorteo.nombre}". Si hoy participas en el intercambio, mejor no lo veas: se pierde la magia.`);
    },

    async revelarTodo(numero: string, token: string | null, codigo: string): Promise<Resultado<{ pares: { dador: string; receptor: string | null }[] }>> {
      const r = await organizadorDeToken(numero, token);
      if (!r.ok) return r;
      const v = await comprobarCodigo('revelar', r.sorteo.numero, r.sorteo.organizador.correo, codigo);
      if (!v.ok) return v;
      const s = r.sorteo;
      return { ok: true, pares: s.espacios.map((e) => ({ dador: e.nombre, receptor: s.invitados[e.id]?.toca ? nombreDe(s, s.invitados[e.id].toca!) : null })) };
    },

    // ---------- Para Laymon  ----------
    async listarAdmin() {
      const numeros = await store.zrevrange(K.indice, 200);
      const sorteos = (await store.mget<Sorteo>(numeros.map(K.sorteo))).filter(Boolean) as Sorteo[];
      return sorteos.map((s) => ({
        numero: s.numero,
        nombre: s.nombre,
        tipo: s.tipo,
        creadoEn: s.creadoEn,
        fecha: s.fecha,
        organizador: s.organizador.nombreCompleto,
        correoOrganizador: s.organizador.correo,
        total: s.espacios.length,
        registrados: Object.keys(s.invitados).length,
        sortearon: Object.values(s.invitados).filter((i) => i.toca).length,
        enlace: `${deps.baseUrl()}/${s.numero}`,
      }));
    },

    /** Todas las personas registradas (invitados y organizadores) para contactarlas después */
    async contactos(): Promise<string[][]> {
      const numeros = await store.zrevrange(K.indice, 1000);
      const sorteos = (await store.mget<Sorteo>(numeros.map(K.sorteo))).filter(Boolean) as Sorteo[];
      const fila = (s: Sorteo, rol: string, p: { nombreCompleto: string; edad: number; genero: string; correo: string; telefono: string; sinPromos: boolean }, cuando: number, lista = '') => [
        s.numero, s.nombre, s.tipo === 'laymon' ? 'Evento Laymon' : 'Personal', rol, lista, p.nombreCompleto, String(p.edad), p.genero, p.correo, p.telefono, new Date(cuando).toISOString().slice(0, 10),
      ];
      const filas: string[][] = [['Sorteo', 'Evento', 'Tipo', 'Rol', 'Nombre en lista', 'Nombre completo', 'Edad', 'Género', 'Correo', 'Teléfono', 'Fecha']];
      for (const s of sorteos) {
        if (s.tipo === 'personal') filas.push(fila(s, 'Organizador', s.organizador, s.creadoEn));
        for (const i of Object.values(s.invitados)) filas.push(fila(s, 'Invitado', i, i.registradoEn, nombreDe(s, i.espacio)));
      }
      return filas;
    },
  };

  // ---------- Internos que usan varias funciones ----------
  async function organizadorDeToken(numero: string, token: string | null): Promise<Resultado<{ sorteo: Sorteo }>> {
    const t = leerToken(token);
    const s = await cargar(numero);
    if (!t || t.k !== 'org' || !s || t.n !== s.numero || t.v !== s.organizador.claveHash.slice(0, 12)) return fallo(401, 'Tu sesión de organizador venció. Entra de nuevo con tu clave.');
    return { ok: true, sorteo: s };
  }

  async function avisarOrganizador(s: Sorteo, quien: string): Promise<void> {
    const yaSortearon = new Set(Object.values(s.invitados).filter((i) => i.toca).map((i) => i.espacio));
    const faltanRegistro = s.espacios.filter((e) => !s.invitados[e.id]).map((e) => e.nombre);
    const faltanSortear = s.espacios.filter((e) => s.invitados[e.id] && !yaSortearon.has(e.id)).map((e) => e.nombre);
    const resumen = faltanRegistro.length + faltanSortear.length === 0
      ? '¡Ya sortearon todos! Cada quien tiene su nombre.'
      : `Registrados que todavía no sortean (${faltanSortear.length}): ${faltanSortear.join(', ') || 'ninguno'}.\nSin registrarse aún (${faltanRegistro.length}): ${faltanRegistro.join(', ') || 'ninguno'}.`;
    await deps.enviar(
      s.organizador.correo,
      `${nombreDe(s, quien)} ya sacó su nombre en "${s.nombre}"`,
      `${nombreDe(s, quien)} ya sorteó. Van ${yaSortearon.size} de ${s.espacios.length}.\n\n${resumen}\n\nPuedes recordarles con tu enlace: ${deps.baseUrl()}/${s.numero}\n\nNo te mandamos quién le tocó a quién: así se conserva la magia.\n\nLaymon Pizzería Artesanal`,
    );
  }
}

const enmascarar = (correo: string) => correo.replace(/^(.).*(@.*)$/, (_m, a: string, b: string) => `${a}•••${b}`);
void llaveNombre;
