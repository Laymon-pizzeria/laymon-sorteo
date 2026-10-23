/**
 * Almacenamiento mínimo: llaves con vencimiento y un índice ordenado.
 * En producción vive en Upstash Redis (REST, sin dependencias). Sin credenciales se usa memoria,
 * que sirve para desarrollar pero se borra cada vez que el servidor se reinicia.
 */
export interface Store {
  readonly tipo: 'memoria' | 'upstash';
  get<T>(key: string): Promise<T | null>;
  /** Varias llaves en una sola llamada, en el mismo orden */
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  /** Los `limit` miembros con mayor puntaje */
  zrevrange(key: string, limit: number): Promise<string[]>;
  zrem(key: string, member: string): Promise<void>;
  /** Quita del índice los miembros con puntaje menor a `max` (los que ya vencieron) */
  zremAntesDe(key: string, max: number): Promise<void>;
  /** Solo en la memoria de este proceso, sin gastar una consulta (si el almacén lo permite). */
  recordar?(key: string, value: unknown, ttlSeconds?: number): void;
}

export function crearStoreMemoria(ahora: () => number = Date.now): Store {
  const datos = new Map<string, { valor: string; vence?: number }>();
  const indices = new Map<string, Map<string, number>>();

  return {
    tipo: 'memoria',
    async get<T>(key: string) {
      const e = datos.get(key);
      if (!e) return null;
      if (e.vence !== undefined && e.vence <= ahora()) {
        datos.delete(key);
        return null;
      }
      return JSON.parse(e.valor) as T;
    },
    async mget<T>(keys: string[]) {
      return keys.map((k) => {
        const e = datos.get(k);
        if (!e || (e.vence !== undefined && e.vence <= ahora())) return null;
        return JSON.parse(e.valor) as T;
      });
    },
    async set(key, value, ttl) {
      datos.set(key, { valor: JSON.stringify(value), vence: ttl ? ahora() + ttl * 1000 : undefined });
    },
    async del(key) {
      datos.delete(key);
    },
    async zadd(key, score, member) {
      if (!indices.has(key)) indices.set(key, new Map());
      indices.get(key)!.set(member, score);
    },
    async zrevrange(key, limit) {
      const idx = indices.get(key);
      if (!idx) return [];
      return [...idx.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([m]) => m);
    },
    async zrem(key, member) {
      indices.get(key)?.delete(member);
    },
    async zremAntesDe(key, max) {
      const idx = indices.get(key);
      for (const [m, score] of idx ?? []) if (score < max) idx!.delete(m);
    },
  };
}

export function crearStoreUpstash(url: string, token: string, fetchFn: typeof fetch = fetch): Store {
  async function cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Upstash respondió ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(`Upstash: ${json.error}`);
    return json.result;
  }

  return {
    tipo: 'upstash',
    async get<T>(key: string) {
      const r = await cmd(['GET', key]);
      return typeof r === 'string' ? (JSON.parse(r) as T) : null;
    },
    async mget<T>(keys: string[]) {
      if (keys.length === 0) return [];
      const r = await cmd(['MGET', ...keys]);
      const lista = Array.isArray(r) ? (r as unknown[]) : [];
      return keys.map((_, i) => (typeof lista[i] === 'string' ? (JSON.parse(lista[i] as string) as T) : null));
    },
    async set(key, value, ttl) {
      const args: (string | number)[] = ['SET', key, JSON.stringify(value)];
      if (ttl) args.push('EX', ttl);
      await cmd(args);
    },
    async del(key) {
      await cmd(['DEL', key]);
    },
    async zadd(key, score, member) {
      await cmd(['ZADD', key, score, member]);
    },
    async zrevrange(key, limit) {
      const r = await cmd(['ZREVRANGE', key, 0, limit - 1]);
      return Array.isArray(r) ? (r as string[]) : [];
    },
    async zrem(key, member) {
      await cmd(['ZREM', key, member]);
    },
    async zremAntesDe(key, max) {
      await cmd(['ZREMRANGEBYSCORE', key, '-inf', `(${max}`]);
    },
  };
}

/**
 * Memoria de lecturas encima del almacén. El panel, la app de reparto y la página del cliente
 * preguntan cada pocos segundos; casi siempre la respuesta no cambió. Como todas las escrituras
 * pasan por este mismo proceso, se guardan aquí al escribir y una lectura repetida no va a Upstash.
 * Cada lectura guardada vence a los `vigenciaMs` (por si otro proceso escribió) o con el TTL de la llave.
 */
export type StoreConUso = Store & { comandos(): number; usoDelMes(): Promise<number> };

export function conMemoriaDeLecturas(base: Store, vigenciaMs = 120_000, ahora: () => number = Date.now): StoreConUso {
  const valores = new Map<string, { valor: unknown; vence: number }>();
  const rangos = new Map<string, { valor: string[]; vence: number }>();
  let comandos = 0;

  // Cuenta las consultas del mes en Upstash (el plan gratis corta al pasar de 500 mil).
  // Se suman aquí y se guardan cada 5 min, para que contar no gaste casi nada.
  let porGuardar = 0;
  let ultimoGuardado = ahora();
  let totalConocido: number | null = null;
  const llaveUso = () => `uso:${new Date(ahora()).toISOString().slice(0, 7)}`;
  async function guardarUso(): Promise<number> {
    const llave = llaveUso();
    const suma = porGuardar + 2;
    porGuardar = 0;
    ultimoGuardado = ahora();
    const previo = (await base.get<number>(llave)) ?? 0;
    await base.set(llave, previo + suma, 40 * 24 * 3600);
    totalConocido = previo + suma;
    return totalConocido;
  }
  const contar = () => {
    comandos++;
    porGuardar++;
    if (ahora() - ultimoGuardado > 5 * 60_000) void guardarUso().catch(() => {});
  };

  const vigente = <T extends { vence: number }>(e: T | undefined) => (e && e.vence > ahora() ? e : undefined);
  // Quien lee puede modificar lo que recibe: se entrega una copia para no ensuciar lo guardado.
  const copia = <T>(v: T): T => (v === null || typeof v !== 'object' ? v : structuredClone(v));
  const guardar = (key: string, valor: unknown, ttlSeconds?: number) => {
    const vence = Math.min(ahora() + vigenciaMs, ttlSeconds ? ahora() + ttlSeconds * 1000 : Infinity);
    valores.set(key, { valor, vence });
  };
  const olvidarRangos = (key: string) => {
    for (const k of rangos.keys()) if (k.startsWith(`${key}|`)) rangos.delete(k);
  };

  return {
    tipo: base.tipo,
    comandos: () => comandos,
    // Estado lo pide cada 8 s: con el dato de hace menos de un minuto basta.
    recordar(key, value, ttlSeconds) {
      guardar(key, JSON.parse(JSON.stringify(value ?? null)), ttlSeconds);
    },
    usoDelMes: () =>
      totalConocido !== null && ahora() - ultimoGuardado < 60_000 ? Promise.resolve(totalConocido + porGuardar) : guardarUso(),
    async get<T>(key: string) {
      const e = vigente(valores.get(key));
      if (e) return copia(e.valor as T | null);
      contar();
      const v = await base.get<T>(key);
      guardar(key, v);
      return copia(v);
    },
    async mget<T>(keys: string[]) {
      const faltan = [...new Set(keys.filter((k) => !vigente(valores.get(k))))];
      if (faltan.length > 0) {
        contar();
        const leidos = await base.mget<T>(faltan);
        faltan.forEach((k, i) => guardar(k, leidos[i]));
      }
      return keys.map((k) => copia((valores.get(k)?.valor ?? null) as T | null));
    },
    async set(key, value, ttlSeconds) {
      contar();
      await base.set(key, value, ttlSeconds);
      // Se guarda como quedó en Upstash (ida y vuelta por JSON), no la referencia que se puede seguir mutando.
      guardar(key, JSON.parse(JSON.stringify(value ?? null)), ttlSeconds);
    },
    async del(key) {
      contar();
      await base.del(key);
      guardar(key, null);
    },
    async zadd(key, score, member) {
      contar();
      await base.zadd(key, score, member);
      olvidarRangos(key);
    },
    async zrevrange(key, limit) {
      const k = `${key}|${limit}`;
      const e = vigente(rangos.get(k));
      if (e) return [...e.valor];
      contar();
      const v = await base.zrevrange(key, limit);
      rangos.set(k, { valor: v, vence: ahora() + vigenciaMs });
      return [...v];
    },
    async zrem(key, member) {
      contar();
      await base.zrem(key, member);
      olvidarRangos(key);
    },
    async zremAntesDe(key, max) {
      contar();
      await base.zremAntesDe(key, max);
      olvidarRangos(key);
    },
  };
}
