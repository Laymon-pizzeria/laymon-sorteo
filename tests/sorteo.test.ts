import { describe, expect, it } from 'vitest';
import { crearSorteos } from '../lib/sorteo-almacen';
import { elegirReceptor, funcionPermitido, hayEmparejamiento, validarConfig, validarPersona } from '../lib/sorteo';
import { crearStoreMemoria } from '../lib/store';

describe('lógica del sorteo', () => {
  it('nunca se atora: miles de sorteos con reglas cierran el círculo completo', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const permitido = funcionPermitido(['a>b', 'b>a', 'c>d', 'd>c', 'e>f']);
    for (let vuelta = 0; vuelta < 400; vuelta++) {
      const orden = [...ids].sort(() => Math.random() - 0.5);
      let libres = [...ids];
      let pendientes = [...ids];
      const toco = new Map<string, string>();
      for (const d of orden) {
        const r = elegirReceptor(d, pendientes, libres, permitido);
        expect(r, `vuelta ${vuelta}`).not.toBeNull();
        expect(permitido(d, r!)).toBe(true);
        toco.set(d, r!);
        libres = libres.filter((x) => x !== r);
        pendientes = pendientes.filter((x) => x !== d);
      }
      expect(new Set(toco.values()).size).toBe(ids.length);
    }
  });

  it('detecta reglas imposibles', () => {
    const r = validarConfig({
      nombres: [{ nombre: 'Ana' }, { nombre: 'Beto' }, { nombre: 'Carla' }],
      exclusiones: [{ de: 'Ana', a: 'Beto' }, { de: 'Ana', a: 'Carla' }],
    });
    expect('error' in r && r.error).toContain('no se puede cerrar');
    expect(hayEmparejamiento(['a', 'b'], ['a', 'b'], funcionPermitido([]))).toBe(true);
  });

  it('valida nombres: mínimo 3, sin repetidos (aunque cambie acento o mayúsculas)', () => {
    expect('error' in validarConfig({ nombres: [{ nombre: 'Ana' }, { nombre: 'Beto' }], exclusiones: [] })).toBe(true);
    const r = validarConfig({ nombres: [{ nombre: 'José' }, { nombre: 'jose' }, { nombre: 'Ana' }], exclusiones: [] });
    expect('error' in r && r.error).toContain('dos veces');
  });

  it('los datos de la persona: mayor de edad, teléfono a 10 dígitos y aviso aceptado', () => {
    const base = { nombreCompleto: 'Ana Pérez López', edad: 30, genero: 'Mujer', correo: 'ANA@ejemplo.com', telefono: '+52 55 1234 5678', aviso: true };
    expect(validarPersona(base)).toMatchObject({ correo: 'ana@ejemplo.com', telefono: '5512345678', sinPromos: false });
    expect('error' in validarPersona({ ...base, edad: 15 })).toBe(true);
    expect('error' in validarPersona({ ...base, aviso: false })).toBe(true);
    expect('error' in validarPersona({ ...base, nombreCompleto: 'Ana' })).toBe(true);
    expect('error' in validarPersona({ ...base, telefono: '123' })).toBe(true);
  });
});

function montar() {
  const correos: { para: string; asunto: string; texto: string }[] = [];
  const s = crearSorteos({
    store: crearStoreMemoria(),
    secreto: 'secreto-de-prueba',
    baseUrl: () => 'https://sorteo.test',
    enviar: async (para, asunto, texto) => {
      correos.push({ para, asunto, texto });
      return { ok: true, detalle: 'ok' };
    },
  });
  /** Último código que se mandó a ese correo */
  const codigo = (para: string) => [...correos].reverse().find((c) => c.para === para)!.texto.match(/Tu código es: (\d{6})/)![1];
  return { s, correos, codigo };
}

const persona = (nombreCompleto: string, correo: string, extra: object = {}) => ({ nombreCompleto, edad: 30, genero: 'Mujer', correo, telefono: '5512345678', aviso: true, ...extra });
const NOMBRES = ['Ana', 'Beto', 'Carla', 'Dani'].map((nombre) => ({ nombre }));

/** AAAA-MM-DD dentro de n días (para fechas válidas sin importar cuándo corran las pruebas) */
const enDias = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function conSorteo() {
  const m = montar();
  const r = await m.s.crearParaEvento({
    nombre: 'Posada de la oficina',
    fecha: enDias(40),
    limite: '$300',
    nombres: NOMBRES,
    exclusiones: [{ de: 'Ana', a: 'Beto', ambos: true }],
    organizador: { nombre: 'Olivia Organiza', correo: 'olivia@ejemplo.com', telefono: '5598765432' },
  });
  if (!r.ok) throw new Error(r.error);
  const info = await m.s.infoPublica(r.numero);
  if (!info.ok) throw new Error(info.error);
  const id = (n: string) => info.libres.find((e) => e.nombre === n)!.id;
  const registrar = async (nombre: string, correo: string, extra: object = {}) => {
    const a = await m.s.registrar(r.numero, { ...persona(`${nombre} Apellido`, correo, extra), espacio: id(nombre) }, '1.1.1.1');
    if (!a.ok) throw new Error(a.error);
    const b = await m.s.verificarInvitado(r.numero, 'registro', correo, m.codigo(correo));
    if (!b.ok) throw new Error(b.error);
    return b.token;
  };
  return { ...m, numero: r.numero, clave: r.clave, registrar, id };
}

describe('sorteo de intercambio de punta a punta', () => {
  it('registrar exige el código del correo y guarda los datos solo al verificarlo', async () => {
    const t = await conSorteo();
    const id = t.id('Ana');
    expect((await t.s.registrar(t.numero, { ...persona('Ana Pérez', 'ana@ejemplo.com'), espacio: id }, '1.1.1.1')).ok).toBe(true);
    // Todavía nadie quedó registrado
    expect(((await t.s.infoPublica(t.numero)) as { registrados: number }).registrados).toBe(0);
    const mal = await t.s.verificarInvitado(t.numero, 'registro', 'ana@ejemplo.com', '000000');
    expect(!mal.ok && mal.error).toContain('no es ese');
    const bien = await t.s.verificarInvitado(t.numero, 'registro', 'ana@ejemplo.com', t.codigo('ana@ejemplo.com'));
    expect(bien.ok).toBe(true);
    expect(((await t.s.infoPublica(t.numero)) as { registrados: number; libres: unknown[] }).libres).toHaveLength(3);
  });

  it('cinco intentos malos queman el código', async () => {
    const t = await conSorteo();
    await t.s.registrar(t.numero, { ...persona('Ana Pérez', 'ana@ejemplo.com'), espacio: t.id('Ana') }, '1.1.1.1');
    for (let i = 0; i < 5; i++) await t.s.verificarInvitado(t.numero, 'registro', 'ana@ejemplo.com', '000000');
    const r = await t.s.verificarInvitado(t.numero, 'registro', 'ana@ejemplo.com', t.codigo('ana@ejemplo.com'));
    expect(r.ok).toBe(false);
  });

  it('no se puede registrar dos veces el mismo nombre ni el mismo correo', async () => {
    const t = await conSorteo();
    await t.registrar('Ana', 'ana@ejemplo.com');
    const mismoNombre = await t.s.registrar(t.numero, { ...persona('Otra Ana', 'otra@ejemplo.com'), espacio: t.id('Ana') }, '1.1.1.1');
    expect(!mismoNombre.ok && mismoNombre.status).toBe(409);
    const mismoCorreo = await t.s.registrar(t.numero, { ...persona('Beto Pérez', 'ana@ejemplo.com'), espacio: t.id('Beto') }, '1.1.1.1');
    expect(!mismoCorreo.ok && mismoCorreo.status).toBe(409);
  });

  it('sortea una sola vez, respeta la regla y lo que ve cada quien no filtra nada de los demás', async () => {
    const t = await conSorteo();
    const ana = await t.registrar('Ana', 'ana@ejemplo.com');
    await t.registrar('Beto', 'beto@ejemplo.com');
    await t.s.guardarDeseos(t.numero, ana, 'Calcetines\n\nUn libro');
    const antes = await t.s.revelar(t.numero, ana);
    expect(antes.ok).toBe(false);
    const a = await t.s.sortear(t.numero, ana);
    expect(a.ok).toBe(true);
    const r1 = await t.s.revelar(t.numero, ana);
    if (!r1.ok) throw new Error(r1.error);
    expect(['Carla', 'Dani']).toContain(r1.nombre); // Ana no puede tocarle Beto (ni ella misma)
    expect(r1.limite).toBe(300);
    // Volver a sortear no cambia el resultado
    await t.s.sortear(t.numero, ana);
    const r2 = await t.s.revelar(t.numero, ana);
    expect(r2.ok && r2.nombre).toBe(r1.nombre);
    // El estado del invitado no trae nada de lo que no le toca
    const estado = JSON.stringify(await t.s.estadoInvitado(t.numero, ana));
    expect(estado).not.toContain(r1.nombre);
    expect(estado).toContain('Calcetines\\nUn libro');
  });

  it('el que saca a otro puede ver su lista de deseos', async () => {
    const t = await conSorteo();
    const carla = await t.registrar('Carla', 'carla@ejemplo.com');
    const dani = await t.registrar('Dani', 'dani@ejemplo.com');
    await t.s.guardarDeseos(t.numero, carla, 'Un termo');
    await t.s.guardarDeseos(t.numero, dani, 'Chocolates');
    for (const token of [carla, dani]) await t.s.sortear(t.numero, token);
    const veCarla = await t.s.revelar(t.numero, carla);
    const veDani = await t.s.revelar(t.numero, dani);
    if (veCarla.ok && veCarla.nombre === 'Dani') expect(veCarla.deseos).toBe('Chocolates');
    if (veDani.ok && veDani.nombre === 'Carla') expect(veDani.deseos).toBe('Un termo');
  });

  it('todos sortean en orden aleatorio y todos terminan con alguien distinto, sin romper la regla', async () => {
    for (let vuelta = 0; vuelta < 15; vuelta++) {
      const t = await conSorteo();
      const tokens: Record<string, string> = {};
      for (const n of ['Ana', 'Beto', 'Carla', 'Dani']) tokens[n] = await t.registrar(n, `${n.toLowerCase()}@ejemplo.com`);
      const toco: Record<string, string> = {};
      for (const n of Object.keys(tokens).sort(() => Math.random() - 0.5)) {
        expect((await t.s.sortear(t.numero, tokens[n])).ok).toBe(true);
        const r = await t.s.revelar(t.numero, tokens[n]);
        if (!r.ok) throw new Error(r.error);
        toco[n] = r.nombre;
      }
      expect(new Set(Object.values(toco)).size).toBe(4);
      for (const [n, a] of Object.entries(toco)) {
        expect(a).not.toBe(n);
        expect(!(n === 'Ana' && a === 'Beto') && !(n === 'Beto' && a === 'Ana')).toBe(true);
      }
    }
  });

  it('el organizador recibe un correo por cada sorteo, con quién falta, y sin decir a quién le tocó', async () => {
    const t = await conSorteo();
    const ana = await t.registrar('Ana', 'ana@ejemplo.com');
    await t.registrar('Beto', 'beto@ejemplo.com');
    await t.s.sortear(t.numero, ana);
    const aviso = t.correos.filter((c) => c.para === 'olivia@ejemplo.com').pop()!;
    expect(aviso.asunto).toContain('Ana ya sacó su nombre');
    expect(aviso.texto).toContain('Van 1 de 4');
    expect(aviso.texto).toContain('Beto');
    expect(aviso.texto).toContain('Sin registrarse aún (2): Carla, Dani');
    const r = await t.s.revelar(t.numero, ana);
    if (r.ok) expect(aviso.texto).not.toContain(`le tocó ${r.nombre}`);
  });

  it('organizador: entra con su clave, ve el avance, y la lista exige un código nuevo', async () => {
    const t = await conSorteo();
    const mal = await t.s.entrarOrganizador(t.numero, 'CLAVEMALA', '2.2.2.2');
    expect(mal.ok).toBe(false);
    const org = await t.s.entrarOrganizador(t.numero, t.clave.toLowerCase(), '2.2.2.2');
    if (!org.ok) throw new Error(org.error);
    const ana = await t.registrar('Ana', 'ana@ejemplo.com');
    await t.s.sortear(t.numero, ana);
    const est = await t.s.estadoOrganizador(t.numero, org.token);
    if (!est.ok) throw new Error(est.error);
    expect(est.espacios.find((e) => e.nombre === 'Ana')).toMatchObject({ registrado: true, sorteo: true });
    expect(est.espacios.find((e) => e.nombre === 'Beto')).toMatchObject({ registrado: false, sorteo: false });
    expect(JSON.stringify(est)).not.toContain('ana@ejemplo.com'); // el organizador no ve datos de contacto
    expect(est.organizador.correo).toBe('o•••@ejemplo.com');
    // Ver los nombres sorteados pide un código al correo del organizador
    expect((await t.s.revelarTodo(t.numero, org.token, '123456')).ok).toBe(false);
    expect((await t.s.pedirCodigoRevelar(t.numero, org.token, '2.2.2.2')).ok).toBe(true);
    const lista = await t.s.revelarTodo(t.numero, org.token, t.codigo('olivia@ejemplo.com'));
    if (!lista.ok) throw new Error(lista.error);
    expect(lista.pares.find((p) => p.dador === 'Ana')?.receptor).toMatch(/Carla|Dani/);
    expect(lista.pares.find((p) => p.dador === 'Beto')?.receptor).toBeNull();
  });

  it('después del primer sorteo la lista y las reglas se bloquean; el límite y la fecha no', async () => {
    const t = await conSorteo();
    const org = await t.s.entrarOrganizador(t.numero, t.clave, '2.2.2.2');
    if (!org.ok) throw new Error(org.error);
    const ok = await t.s.configurar(t.numero, org.token, { nombres: [...NOMBRES, { nombre: 'Eva' }] });
    expect(ok.ok).toBe(true);
    const ana = await t.registrar('Ana', 'ana@ejemplo.com');
    await t.s.sortear(t.numero, ana);
    const bloqueada = await t.s.configurar(t.numero, org.token, { nombres: NOMBRES });
    expect(!bloqueada.ok && bloqueada.status).toBe(409);
    expect((await t.s.configurar(t.numero, org.token, { limite: 500, fecha: enDias(41) })).ok).toBe(true);
    const est = await t.s.estadoOrganizador(t.numero, org.token);
    expect(est.ok && est.limite).toBe(500);
  });

  it('liberar un lugar solo si esa persona todavía no sortea', async () => {
    const t = await conSorteo();
    const org = await t.s.entrarOrganizador(t.numero, t.clave, '2.2.2.2');
    if (!org.ok) throw new Error(org.error);
    const ana = await t.registrar('Ana', 'ana@ejemplo.com');
    expect((await t.s.liberar(t.numero, org.token, t.id('Ana'))).ok).toBe(true);
    expect((await t.s.estadoInvitado(t.numero, ana)).ok).toBe(false); // su sesión ya no vale
    const otra = await t.registrar('Ana', 'ana2@ejemplo.com');
    await t.s.sortear(t.numero, otra);
    const r = await t.s.liberar(t.numero, org.token, t.id('Ana'));
    expect(!r.ok && r.status).toBe(409);
  });

  it('volver a entrar con el correo funciona y no revela si un correo existe', async () => {
    const t = await conSorteo();
    await t.registrar('Ana', 'ana@ejemplo.com');
    const antes = t.correos.length;
    expect((await t.s.pedirEntrada(t.numero, 'desconocido@ejemplo.com', '3.3.3.3')).ok).toBe(true);
    expect(t.correos.length).toBe(antes);
    expect((await t.s.pedirEntrada(t.numero, 'ana@ejemplo.com', '3.3.3.3')).ok).toBe(true);
    const dentro = await t.s.verificarInvitado(t.numero, 'entrar', 'ana@ejemplo.com', t.codigo('ana@ejemplo.com'));
    expect(dentro.ok).toBe(true);
  });

  it('un token de un sorteo no abre otro, ni uno inventado', async () => {
    const t = await conSorteo();
    const ana = await t.registrar('Ana', 'ana@ejemplo.com');
    const otro = await t.s.crearParaEvento({ nombre: 'Otro', nombres: NOMBRES, organizador: { nombre: 'Pablo Pérez', correo: 'p@ejemplo.com', telefono: '5500000000' } });
    if (!otro.ok) throw new Error(otro.error);
    expect((await t.s.estadoInvitado(otro.numero, ana)).ok).toBe(false);
    expect((await t.s.estadoInvitado(t.numero, `${ana.split('.')[0]}.firmafalsa`)).ok).toBe(false);
    expect((await t.s.estadoInvitado(t.numero, null)).ok).toBe(false);
  });

  it('cualquiera puede crear su propio sorteo: con código al correo y recibe número y clave', async () => {
    const m = montar();
    const entrada = { nombre: 'Intercambio familiar', nombres: NOMBRES, organizador: persona('Lucía Gómez Ruiz', 'lucia@ejemplo.com') };
    expect((await m.s.iniciarCreacion(entrada, '4.4.4.4')).ok).toBe(true);
    expect(((await m.s.listarAdmin()) as unknown[]).length).toBe(0); // todavía no existe
    const r = await m.s.terminarCreacion('lucia@ejemplo.com', m.codigo('lucia@ejemplo.com'));
    if (!r.ok) throw new Error(r.error);
    expect(r.numero).toMatch(/^[A-Z2-9]{6}$/);
    expect(r.enlace).toBe(`https://sorteo.test/${r.numero}`);
    const correo = m.correos.find((c) => c.asunto.includes('está listo'))!;
    expect(correo.texto).toContain(r.clave);
    const contactos = await m.s.contactos();
    expect(contactos[1]).toContain('Lucía Gómez Ruiz'); // el organizador también queda en los contactos
  });

  it('los contactos incluyen a los invitados registrados', async () => {
    const t = await conSorteo();
    await t.registrar('Ana', 'ana@ejemplo.com');
    await t.registrar('Beto', 'beto@ejemplo.com');
    const filas = await t.s.contactos();
    const ana = filas.find((f) => f[8] === 'ana@ejemplo.com')!;
    const beto = filas.find((f) => f[8] === 'beto@ejemplo.com')!;
    expect(ana).toBeTruthy();
    expect(beto).toBeTruthy();
  });

  it('sin secreto en el servidor, nada abre', async () => {
    const s = crearSorteos({ store: crearStoreMemoria(), secreto: null, baseUrl: () => '', enviar: async () => ({ ok: true, detalle: '' }) });
    const r = await s.registrar('ABC234', {}, '1.1.1.1');
    expect(!r.ok && r.status).toBe(503);
    const c = await s.iniciarCreacion({ nombre: 'x', nombres: NOMBRES, organizador: persona('Ana Pérez', 'a@b.co') }, '1.1.1.1');
    expect(!c.ok && c.status).toBe(503);
  });

  it('si el correo no sale, avisa y no deja nada a medias', async () => {
    const s = crearSorteos({ store: crearStoreMemoria(), secreto: 'x', baseUrl: () => '', enviar: async () => ({ ok: false, detalle: 'HTTP 403' }) });
    const c = await s.iniciarCreacion({ nombre: 'x', nombres: NOMBRES, organizador: persona('Ana Pérez', 'a@b.co') }, '1.1.1.1');
    expect(!c.ok && c.status).toBe(502);
  });
});

describe('fecha y reparto', () => {
  it('rechaza fechas que no existen o ya pasaron', async () => {
    const m = montar();
    const base = { nombre: 'Posada', nombres: NOMBRES, organizador: { nombre: 'Olivia Organiza', correo: 'olivia@ejemplo.com', telefono: '5598765432' } };
    for (const fecha of ['2026-12-34', '19 de diciembre', '2020-01-01']) {
      const r = await m.s.crearParaEvento({ ...base, fecha });
      expect(r.ok).toBe(false);
    }
    expect((await m.s.crearParaEvento({ ...base, fecha: enDias(10) })).ok).toBe(true);
  });

  it('nadie puede sacar su propio nombre', () => {
    expect(funcionPermitido([])('a', 'a')).toBe(false);
  });
});
