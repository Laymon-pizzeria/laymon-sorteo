import { randomInt } from 'node:crypto';
import { correoValido } from './correo';

/**
 * Sorteo de intercambio: lógica pura (sin almacén ni correo).
 * Cada persona sortea por su cuenta, pero el resultado nunca se atora: antes de dar un nombre se comprueba
 * que con los que quedan todavía se pueda cerrar el círculo respetando las reglas de exclusión.
 */

export const VERSION_AVISO = 'v1-2026-10';
export const MAX_ESPACIOS = 60;
export const MIN_ESPACIOS = 3;
export const GENEROS = ['Mujer', 'Hombre', 'No binario u otro', 'Prefiero no decirlo'] as const;

/** Sin 0/O/1/I/L para que se pueda dictar por teléfono sin confusiones */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigoAleatorio = (largo: number, azar: (max: number) => number = (m) => randomInt(0, m)) =>
  Array.from({ length: largo }, () => ALFABETO[azar(ALFABETO.length)]).join('');

export const generarNumeroSorteo = (azar?: (max: number) => number) => codigoAleatorio(6, azar);
export const generarClaveOrganizador = (azar?: (max: number) => number) => codigoAleatorio(8, azar);
export const generarCodigoCorreo = (azar: (max: number) => number = (m) => randomInt(0, m)) => String(100000 + azar(900000));

export const normalizarNumero = (n: string) => n.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
export const normalizarClave = normalizarNumero;
export const limpiar = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const llaveNombre = (s: string) => sinAcentos(limpiar(s, 80));

export interface Espacio {
  id: string;
  nombre: string;
}

/** "a>b": a no puede regalarle a b */
export type Exclusion = string;
export const exclusion = (de: string, a: string): Exclusion => `${de}>${a}`;

export function funcionPermitido(exclusiones: Exclusion[]): (dador: string, receptor: string) => boolean {
  const prohibidas = new Set(exclusiones);
  return (d, r) => d !== r && !prohibidas.has(exclusion(d, r));
}

/** ¿Se pueden emparejar todos los dadores con todos los receptores sin romper reglas? (Kuhn) */
export function hayEmparejamiento(dadores: string[], receptores: string[], permitido: (d: string, r: string) => boolean): boolean {
  if (dadores.length !== receptores.length) return false;
  const dueno = new Map<string, string>();
  const intentar = (d: string, vistos: Set<string>): boolean => {
    for (const r of receptores) {
      if (!permitido(d, r) || vistos.has(r)) continue;
      vistos.add(r);
      const otro = dueno.get(r);
      if (otro === undefined || intentar(otro, vistos)) {
        dueno.set(r, d);
        return true;
      }
    }
    return false;
  };
  return dadores.every((d) => intentar(d, new Set()));
}

const mezclar = <T>(lista: T[], azar: (max: number) => number = (m) => randomInt(0, m)): T[] => {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = azar(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Le toca un nombre al azar a `dador` entre los que siguen libres, sin romper reglas y dejando el resto resoluble.
 * `dadoresPendientes` incluye al propio dador; `receptoresLibres` son los que nadie ha sacado todavía.
 */
export function elegirReceptor(
  dador: string,
  dadoresPendientes: string[],
  receptoresLibres: string[],
  permitido: (d: string, r: string) => boolean,
  azar?: (max: number) => number,
): string | null {
  const resto = dadoresPendientes.filter((d) => d !== dador);
  for (const r of mezclar(receptoresLibres.filter((x) => permitido(dador, x)), azar)) {
    if (hayEmparejamiento(resto, receptoresLibres.filter((x) => x !== r), permitido)) return r;
  }
  return null;
}

export interface EntradaConfig {
  nombres: { id?: string; nombre: string }[];
  /** pares [nombre o id de quien da, nombre o id de quien recibe] */
  exclusiones: { de: string; a: string; ambos?: boolean }[];
}

/** Valida la lista de nombres y las reglas. Conserva los ids que ya existían y crea ids nuevos (e1, e2…). */
export function validarConfig(entrada: EntradaConfig, previos: Espacio[] = []): { espacios: Espacio[]; exclusiones: Exclusion[] } | { error: string } {
  if (!Array.isArray(entrada.nombres)) return { error: 'Escribe los nombres de tus invitados.' };
  if (entrada.nombres.length < MIN_ESPACIOS) return { error: `Un intercambio necesita al menos ${MIN_ESPACIOS} personas.` };
  if (entrada.nombres.length > MAX_ESPACIOS) return { error: `El máximo es ${MAX_ESPACIOS} personas por sorteo.` };
  const usados = new Set<string>();
  const vistos = new Set<string>();
  let siguiente = 1 + Math.max(0, ...previos.map((p) => Number(p.id.slice(1)) || 0));
  const espacios: Espacio[] = [];
  for (const n of entrada.nombres) {
    const nombre = limpiar(n?.nombre, 40);
    if (!nombre) return { error: 'Hay un nombre vacío en la lista.' };
    const llave = llaveNombre(nombre);
    if (vistos.has(llave)) return { error: `"${nombre}" aparece dos veces. Agrega un apellido o una inicial para distinguirlos.` };
    vistos.add(llave);
    const previo = previos.find((p) => p.id === n.id) ?? previos.find((p) => llaveNombre(p.nombre) === llave && !usados.has(p.id));
    let id = previo?.id;
    if (!id || usados.has(id)) id = `e${siguiente++}`;
    usados.add(id);
    espacios.push({ id, nombre });
  }
  const buscar = (ref: string) => espacios.find((e) => e.id === ref) ?? espacios.find((e) => llaveNombre(e.nombre) === llaveNombre(ref));
  const exclusiones = new Set<Exclusion>();
  for (const x of entrada.exclusiones ?? []) {
    const de = buscar(String(x?.de ?? ''));
    const a = buscar(String(x?.a ?? ''));
    if (!de || !a) return { error: 'Una regla usa un nombre que no está en la lista.' };
    if (de.id === a.id) return { error: `La regla de ${de.nombre} no tiene sentido: es la misma persona.` };
    exclusiones.add(exclusion(de.id, a.id));
    if (x.ambos) exclusiones.add(exclusion(a.id, de.id));
  }
  const ids = espacios.map((e) => e.id);
  if (!hayEmparejamiento(ids, ids, funcionPermitido([...exclusiones]))) {
    return { error: 'Con esas reglas no se puede cerrar el sorteo (a alguien no le quedaría nadie a quien regalar). Quita alguna regla.' };
  }
  return { espacios, exclusiones: [...exclusiones] };
}

export function validarMonto(v: unknown): number | null | { error: string } {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return { error: 'El límite de gasto no se ve bien.' };
  return Math.round(n);
}

/** Fecha del intercambio: vacía o AAAA-MM-DD real, de hoy a 3 años. `hoy` en ms (se tolera un día de diferencia por zona horaria). */
export function validarFecha(v: unknown, hoy: number): string | { error: string } {
  if (v === undefined || v === null || v === '') return '';
  const t = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return { error: 'Esa fecha no existe. Elígela del calendario.' };
  if (d.getTime() < hoy - 36 * 3600_000) return { error: 'La fecha del intercambio ya pasó.' };
  if (d.getTime() > hoy + 3 * 366 * 86400_000) return { error: 'La fecha está muy lejos. Elige una dentro de los próximos 3 años.' };
  return t;
}

export interface Persona {
  nombreCompleto: string;
  edad: number;
  genero: (typeof GENEROS)[number];
  correo: string;
  telefono: string;
  /** true = pidió NO recibir promociones */
  sinPromos: boolean;
}

/** Datos que pedimos a todas las personas (invitados y organizador) */
export function validarPersona(x: Record<string, unknown> | null | undefined): Persona | { error: string } {
  const nombreCompleto = limpiar(x?.nombreCompleto, 80);
  if (nombreCompleto.length < 5 || !nombreCompleto.includes(' ')) return { error: 'Escribe tu nombre completo (nombre y apellido).' };
  const edad = Number(x?.edad);
  if (!Number.isInteger(edad) || edad < 1 || edad > 110) return { error: 'Escribe tu edad.' };
  if (edad < 18) return { error: 'Para participar con tus datos necesitas ser mayor de edad. Pídele a una persona adulta de tu familia que se registre por ti.' };
  const genero = GENEROS.find((g) => g === x?.genero);
  if (!genero) return { error: 'Elige una opción de género.' };
  const correo = limpiar(x?.correo, 200).toLowerCase();
  if (!correoValido(correo)) return { error: 'Ese correo no se ve bien.' };
  const telefono = String(x?.telefono ?? '').replace(/\D/g, '').replace(/^(52|521)(?=\d{10}$)/, '');
  if (telefono.length !== 10) return { error: 'Escribe tu teléfono a 10 dígitos.' };
  if (x?.aviso !== true) return { error: 'Para continuar acepta el aviso de privacidad.' };
  return { nombreCompleto, edad, genero, correo, telefono, sinPromos: x?.sinPromos === true };
}

export function lista(n: number): string {
  return n === 1 ? '1 persona' : `${n} personas`;
}
