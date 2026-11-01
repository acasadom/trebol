// The fake object store that `trebol dev` serves under /api/objects until
// the real backend exists. It speaks the protocol of docs/metasistema.md
// (section 9): every record is an object, flat in JSON,
//
//   { "id": "4711", "class": "grant", "group": "grants", "amount": 1200.00, ... }
//
// where `id`, `class`, `group` and `version` are system keys and every other
// key is a field id. A Concept is an object of class `concept` whose
// `fields` define the fields of its instances.
//
//   GET    /api/objects?class=grant&group=g   the list, in creation order
//   GET    /api/objects/:id                   one object
//   POST   /api/objects                       creates one (id generated if absent)
//   PUT    /api/objects/:id                   replaces one
//   DELETE /api/objects/:id                   removes one
//
// Objects are checked against the fields of their class: unknown or
// misplaced fields, wrong types, missing required values and repeated
// unique values answer 422 with a message and the field id.

import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Obj = { [k: string]: Json };

export const SYSTEM_KEYS = ['id', 'class', 'group', 'version'];
export const FIELD_TYPES = [
  'text', 'long-text', 'number', 'money', 'date', 'yes-no', 'password', 'choice', 'ref', 'concept-ref',
  'refs', 'table', 'calculated', 'link', 'file', 'image', 'address', 'design',
];
const LEVELS = ['class', 'instance', 'both'];
/** Concepts that come with an empty system; they can be extended, not deleted. */
const BUILT_IN = ['concept', 'group', 'user', 'role'];

/** A failed check: the message and, when there is one, the field at fault. */
export class Invalid extends Error {
  readonly status: number;
  readonly field: string | null;
  constructor(message: string, field: string | null = null, status = 422) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const label = (es: string, en: string): Obj => ({ es, en });
const def = (id: string, type: string, es: string, en: string, more: Obj = {}): Obj =>
  ({ id, type, level: 'instance', label: label(es, en), ...more });

/** What an empty system has: the four built-in Concepts, the root and the two homes. */
function bootstrap(): Obj[] {
  return [
    {
      id: 'concept', class: 'concept', version: 1, label: label('Concepto', 'Concept'),
      fields: [
        def('label', 'text', 'Nombre', 'Name', { translated: true, required: true }),
        def('extends', 'concept-ref', 'Hereda de', 'Extends'),
        def('fields', 'design', 'Campos', 'Fields'),
        def('views', 'text', 'Vistas', 'Views'),
      ],
    },
    {
      id: 'group', class: 'concept', version: 1, label: label('Grupo', 'Group'),
      fields: [def('label', 'text', 'Nombre', 'Name', { translated: true, required: true })],
    },
    {
      id: 'user', class: 'concept', version: 1, label: label('Usuario', 'User'),
      fields: [
        def('name', 'text', 'Usuario', 'User name', { required: true, unique: true }),
        def('password', 'password', 'Contraseña', 'Password'),
        def('home', 'ref', 'Inicio', 'Home', { to: 'group' }),
        def('roles', 'refs', 'Roles', 'Roles', { to: 'role' }),
      ],
    },
    {
      id: 'role', class: 'concept', version: 1, label: label('Rol', 'Role'),
      fields: [def('label', 'text', 'Nombre', 'Name', { translated: true, required: true })],
    },
    { id: 'root', class: 'group', label: label('Raíz', 'Root') },
    { id: 'admin-home', class: 'group', group: 'root', label: label('Administración', 'Administration') },
    { id: 'public-home', class: 'group', group: 'root', label: label('Sede', 'Public site') },
    { id: 'administrator', class: 'role', label: label('Administrador', 'Administrator') },
    { id: 'public', class: 'role', label: label('Público', 'Public') },
    { id: 'admin', class: 'user', name: 'admin', home: 'admin-home', roles: ['administrator'] },
  ];
}

const isObj = (v: Json | undefined): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: Json | undefined): string | null => (typeof v === 'string' ? v : null);

export class Store {
  private objects = new Map<string, Obj>();
  private nextId = 1;

  constructor() {
    for (const o of bootstrap()) this.objects.set(o.id as string, o);
  }

  get(id: string): Obj | null {
    const o = this.objects.get(id);
    return o === undefined ? null : this.outward(o);
  }

  list(filter: { class?: string; group?: string } = {}): Obj[] {
    const out: Obj[] = [];
    for (const o of this.objects.values()) {
      if (filter.class !== undefined && o.class !== filter.class) continue;
      if (filter.group !== undefined && o.group !== filter.group) continue;
      out.push(this.outward(o));
    }
    return out;
  }

  create(body: Json): Obj {
    if (!isObj(body)) throw new Invalid('The body must be a JSON object');
    let id = body.id;
    if (id === undefined || id === null) {
      while (this.objects.has(String(this.nextId))) this.nextId++;
      id = String(this.nextId++);
    }
    if (typeof id !== 'string' || id === '') throw new Invalid('An id must be a non-empty string', 'id');
    if (this.objects.has(id)) throw new Invalid(`There is already an object with id ${id}`, 'id', 409);
    const o = this.check({ ...body, id }, null);
    this.objects.set(id, o);
    return this.outward(o);
  }

  replace(id: string, body: Json): Obj {
    const old = this.objects.get(id);
    if (old === undefined) throw new Invalid(`No object with id ${id}`, null, 404);
    if (!isObj(body)) throw new Invalid('The body must be a JSON object');
    if (body.id !== undefined && body.id !== id) throw new Invalid('The id of an object cannot change', 'id');
    if (body.class !== undefined && body.class !== old.class) throw new Invalid('The class of an object cannot change', 'class');
    const o = this.check({ ...body, id, class: old.class as string }, old);
    this.objects.set(id, o);
    return this.outward(o);
  }

  remove(id: string): void {
    const o = this.objects.get(id);
    if (o === undefined) throw new Invalid(`No object with id ${id}`, null, 404);
    if (BUILT_IN.includes(id)) throw new Invalid(`${id} comes with the system and cannot be deleted`, null, 409);
    for (const other of this.objects.values()) {
      if (other.class === id) throw new Invalid(`${id} still has objects`, null, 409);
      if (other.group === id) throw new Invalid(`${id} still contains objects`, null, 409);
      if (other.extends === id) throw new Invalid(`${other.id as string} extends ${id}`, null, 409);
    }
    this.objects.delete(id);
  }

  // --- classes ---------------------------------------------------------------------

  private isConcept(id: string): boolean {
    const o = this.objects.get(id);
    return o !== undefined && this.inherits(o.class as string, 'concept');
  }

  /** Whether a Concept is `ancestor` or extends it, at any depth. */
  private inherits(conceptId: string, ancestor: string): boolean {
    const seen = new Set<string>();
    for (let c: string | null = conceptId; c !== null && !seen.has(c); c = str(this.objects.get(c)?.extends)) {
      if (c === ancestor) return true;
      seen.add(c);
    }
    return false;
  }

  /** The fields of a Concept, inherited ones first; a child's field replaces its parent's. */
  fieldsOf(conceptId: string): Obj[] {
    const chain: Obj[] = [];
    const seen = new Set<string>();
    for (let c: string | null = conceptId; c !== null && !seen.has(c); ) {
      const o = this.objects.get(c);
      if (o === undefined) break;
      chain.unshift(o);
      seen.add(c);
      c = str(o.extends);
    }
    const byId = new Map<string, Obj>();
    for (const o of chain) for (const f of Array.isArray(o.fields) ? o.fields : []) if (isObj(f)) byId.set(f.id as string, f);
    return [...byId.values()];
  }

  // --- checks -------------------------------------------------------------------------

  private check(o: Obj, old: Obj | null): Obj {
    const cls = str(o.class);
    if (cls === null) throw new Invalid('An object needs a class', 'class');
    if (!this.isConcept(cls)) throw new Invalid(`${cls} is not a Concept`, 'class');
    if (o.group !== undefined && o.group !== null) {
      const g = str(o.group);
      const go = g === null ? undefined : this.objects.get(g);
      if (go === undefined || !this.inherits(go.class as string, 'group')) throw new Invalid('The group must be a group', 'group');
    }
    if (o.version !== undefined && !(Number.isInteger(o.version) && (o.version as number) >= 1)) {
      throw new Invalid('A version is a whole number from 1', 'version');
    }
    const isConcept = this.inherits(cls, 'concept');
    if (isConcept) this.checkDefinition(o);

    // An instance carries instance and both-level values of its class; a
    // Concept also carries the class and both-level values of its own fields.
    const allowed = new Map<string, Obj>();
    for (const f of this.fieldsOf(cls)) if (f.level !== 'class') allowed.set(f.id as string, f);
    const own = isConcept ? this.ownFields(o) : [];
    for (const f of own) if (f.level !== 'instance') allowed.set(f.id as string, f);

    const out: Obj = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === null || v === undefined) continue;
      if (SYSTEM_KEYS.includes(k)) {
        out[k] = v;
        continue;
      }
      const f = allowed.get(k);
      if (f === undefined) throw new Invalid(`${cls} has no field ${k} here`, k);
      if (f.type === 'calculated') throw new Invalid(`${k} is calculated and cannot be set`, k);
      out[k] = this.checkValue(f, v, old?.[k]);
    }
    for (const f of this.fieldsOf(cls)) {
      if (f.level === 'class' || f.required !== true || out[f.id as string] !== undefined) continue;
      if (f.level === 'both' && this.objects.get(cls)?.[f.id as string] !== undefined) continue;
      if (f.type === 'password' && old?.[f.id as string] !== undefined) continue;
      throw new Invalid(`${f.id as string} is required`, f.id as string);
    }
    for (const f of own) {
      if (f.level === 'class' && f.required === true && out[f.id as string] === undefined) {
        throw new Invalid(`${f.id as string} is required`, f.id as string);
      }
    }
    for (const f of this.fieldsOf(cls)) {
      const v = out[f.id as string];
      if (f.unique !== true || v === undefined) continue;
      for (const other of this.objects.values()) {
        if (other.class === cls && other.id !== o.id && JSON.stringify(other[f.id as string]) === JSON.stringify(v)) {
          throw new Invalid(`Another object already has this ${f.id as string}`, f.id as string);
        }
      }
    }
    // a password left out of a replace keeps its hash
    if (old !== null) for (const f of this.fieldsOf(cls)) if (f.type === 'password' && out[f.id as string] === undefined && old[f.id as string] !== undefined) out[f.id as string] = old[f.id as string]!;
    return out;
  }

  /** The fields a Concept object defines itself (not those it inherits). */
  private ownFields(o: Obj): Obj[] {
    return Array.isArray(o.fields) ? (o.fields.filter(isObj) as Obj[]) : [];
  }

  /** Checks the definition of a Concept: its `extends` and its field list. */
  private checkDefinition(o: Obj): void {
    if (o.extends !== undefined && o.extends !== null) {
      const e = str(o.extends);
      if (e === null || !this.isConcept(e)) throw new Invalid('extends must name a Concept', 'extends');
      if (this.inherits(e, o.id as string)) throw new Invalid(`${o.id as string} cannot extend itself`, 'extends');
    }
    if (o.fields === undefined || o.fields === null) return;
    if (!Array.isArray(o.fields)) throw new Invalid('fields must be a list', 'fields');
    const ids = new Set<string>();
    for (const f of o.fields) this.checkField(f, ids, 'fields');
  }

  private checkField(f: Json, ids: Set<string>, where: string): void {
    if (!isObj(f)) throw new Invalid(`Each entry of ${where} must be an object`, where);
    const id = str(f.id);
    if (id === null || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Invalid(`A field id is lowercase letters, digits and dashes: ${JSON.stringify(f.id)}`, where);
    if (SYSTEM_KEYS.includes(id)) throw new Invalid(`${id} is reserved and cannot name a field`, where);
    if (ids.has(id)) throw new Invalid(`The field ${id} is defined twice`, where);
    ids.add(id);
    if (!FIELD_TYPES.includes(f.type as string)) throw new Invalid(`${id} has an unknown type ${JSON.stringify(f.type)}`, where);
    if (!LEVELS.includes(f.level as string)) throw new Invalid(`${id} needs a level: class, instance or both`, where);
    if (f.type === 'choice') {
      if (!Array.isArray(f.options) || f.options.length === 0) throw new Invalid(`${id} needs options`, where);
      const opts = new Set<string>();
      for (const opt of f.options) {
        const oid = isObj(opt) ? str(opt.id) : null;
        if (oid === null || opts.has(oid)) throw new Invalid(`Each option of ${id} needs its own id`, where);
        opts.add(oid);
      }
    }
    if ((f.type === 'ref' || f.type === 'refs') && f.to !== undefined && !this.isConcept(str(f.to) ?? '')) {
      throw new Invalid(`${id} refers to ${JSON.stringify(f.to)}, which is not a Concept`, where);
    }
    if (f.type === 'table') {
      if (!Array.isArray(f.columns) || f.columns.length === 0) throw new Invalid(`${id} needs columns`, where);
      const cols = new Set<string>();
      for (const c of f.columns) this.checkField(c, cols, id);
    }
  }

  private checkValue(f: Obj, v: Json, old: Json | undefined): Json {
    const id = f.id as string;
    const bad = (what: string): never => {
      throw new Invalid(`${id} must be ${what}`, id);
    };
    switch (f.type) {
      case 'text': case 'long-text':
        if (f.translated === true) {
          if (!isObj(v) || !Object.values(v).every(s => typeof s === 'string')) bad('a text per language');
          return v;
        }
        return typeof v === 'string' ? v : bad('a text');
      case 'number': case 'money':
        return typeof v === 'number' && Number.isFinite(v) ? v : bad('a number');
      case 'date':
        return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(v) ? v : bad('a date');
      case 'yes-no':
        return typeof v === 'boolean' ? v : bad('yes or no');
      case 'password':
        if (typeof v !== 'string') return bad('a text');
        // already a hash: the object was read back and sent again
        if (v === old) return v;
        return 'sha256:' + createHash('sha256').update(v).digest('hex');
      case 'choice': {
        const ids = (f.options as Obj[]).map(o => o.id);
        return typeof v === 'string' && ids.includes(v) ? v : bad(`one of ${ids.join(', ')}`);
      }
      case 'ref': case 'link': case 'concept-ref':
        return this.checkRef(f, v);
      case 'refs': {
        if (!Array.isArray(v)) return bad('a list of ids');
        return v.map(x => this.checkRef(f, x));
      }
      case 'table': {
        if (!Array.isArray(v) || !v.every(isObj)) return bad('a list of rows');
        const cols = f.columns as Obj[];
        return (v as Obj[]).map(row => {
          const out: Obj = {};
          for (const [k, x] of Object.entries(row)) {
            const c = cols.find(c => c.id === k);
            if (c === undefined) throw new Invalid(`${id} has no column ${k}`, id);
            if (x !== null) out[k] = this.checkValue(c, x, undefined);
          }
          for (const c of cols) if (c.required === true && out[c.id as string] === undefined) throw new Invalid(`${id}: ${c.id as string} is required`, id);
          return out;
        });
      }
      case 'design':
        if (!Array.isArray(v)) return bad('a list of fields');
        return v;
      default: // file, image, address: references and data the frontend shapes
        return v;
    }
  }

  private checkRef(f: Obj, v: Json): Json {
    const id = f.id as string;
    const target = str(v);
    const o = target === null ? undefined : this.objects.get(target);
    if (o === undefined) throw new Invalid(`${id} refers to ${JSON.stringify(v)}, which does not exist`, id);
    if (f.type === 'concept-ref' && !this.isConcept(target!)) throw new Invalid(`${id} must refer to a Concept`, id);
    const to = str(f.to);
    if (to !== null && !this.inherits(o.class as string, to)) throw new Invalid(`${id} must refer to a ${to}`, id);
    return v;
  }

  /** An object as the API answers it: password hashes never leave the store. */
  private outward(o: Obj): Obj {
    const out: Obj = { ...o };
    const cls = str(o.class);
    if (cls !== null) for (const f of this.fieldsOf(cls)) if (f.type === 'password') delete out[f.id as string];
    return out;
  }
}

// --- HTTP ----------------------------------------------------------------------------

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Json;
  } catch {
    throw new Invalid('The body must be JSON');
  }
}

/** Answers a request under /api/objects; returns false for other paths. */
export async function handleObjects(store: Store, req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const m = /^\/api\/objects(?:\/([^/]+))?\/?$/.exec(url.pathname);
  if (m === null) return false;
  const id = m[1] !== undefined ? decodeURIComponent(m[1]) : null;
  const method = req.method ?? 'GET';
  try {
    if (id === null && method === 'GET') {
      const filter: { class?: string; group?: string } = {};
      const cls = url.searchParams.get('class');
      const group = url.searchParams.get('group');
      if (cls !== null) filter.class = cls;
      if (group !== null) filter.group = group;
      send(res, 200, store.list(filter));
    } else if (id === null && method === 'POST') {
      send(res, 201, store.create(await readJson(req)));
    } else if (id !== null && method === 'GET') {
      const o = store.get(id);
      if (o === null) throw new Invalid(`No object with id ${id}`, null, 404);
      send(res, 200, o);
    } else if (id !== null && method === 'PUT') {
      send(res, 200, store.replace(id, await readJson(req)));
    } else if (id !== null && method === 'DELETE') {
      store.remove(id);
      send(res, 204);
    } else {
      send(res, 405, { error: `${method} is not allowed here` });
    }
  } catch (e) {
    if (!(e instanceof Invalid)) throw e;
    send(res, e.status, e.field === null ? { error: e.message } : { error: e.message, field: e.field });
  }
  return true;
}
