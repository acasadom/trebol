// The fake object store of the meta-system (tools/objects.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Store, Invalid, type Obj } from '../tools/objects.ts';
import { handleApi } from '../tools/api.ts';

const GRANT: Obj = {
  id: 'grant', class: 'concept', label: { es: 'Solicitud de beca', en: 'Grant application' },
  fields: [
    { id: 'applicant', type: 'text', level: 'instance', required: true },
    { id: 'amount', type: 'money', level: 'instance', required: true },
    { id: 'level', type: 'choice', level: 'both', options: [{ id: 'degree' }, { id: 'master' }] },
    { id: 'deadline', type: 'number', level: 'class', required: true },
    { id: 'code', type: 'text', level: 'instance', unique: true },
  ],
  deadline: 30,
};

const without = (o: Obj, k: string): Obj => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));

function fails(f: () => unknown, field: string | null, status = 422): void {
  assert.throws(f, (e: unknown) => e instanceof Invalid && e.field === field && e.status === status);
}

test('an empty system has the built-in Concepts, the root and the homes', () => {
  const s = new Store();
  assert.deepEqual(s.list({ class: 'concept' }).map(o => o.id), ['concept', 'group', 'user', 'role']);
  assert.equal(s.get('concept')!.class, 'concept');
  assert.deepEqual(s.list({ group: 'root' }).map(o => o.id), ['admin-home', 'public-home']);
  assert.equal(s.get('admin')!.home, 'admin-home');
  fails(() => s.remove('group'), null, 409);
});

test('a Concept is checked and its instances follow its fields', () => {
  const s = new Store();
  s.create(GRANT);
  const a = s.create({ class: 'grant', applicant: 'Ada', amount: 1200.5, code: 'A1' });
  assert.equal(typeof a.id, 'string');
  assert.deepEqual(s.get(a.id as string), a);
  assert.equal(s.list({ class: 'grant' }).length, 1);
  fails(() => s.create({ class: 'grant', amount: 1 }), 'applicant');
  fails(() => s.create({ class: 'grant', applicant: 'X', amount: '1' }), 'amount');
  fails(() => s.create({ class: 'grant', applicant: 'X', amount: 1, level: 'phd' }), 'level');
  fails(() => s.create({ class: 'grant', applicant: 'X', amount: 1, deadline: 5 }), 'deadline');
  fails(() => s.create({ class: 'grant', applicant: 'X', amount: 1, colour: 'red' }), 'colour');
  fails(() => s.create({ class: 'grant', applicant: 'X', amount: 1, code: 'A1' }), 'code');
  fails(() => s.create({ class: 'nope', applicant: 'X' }), 'class');
  fails(() => s.create({ ...without(GRANT, 'deadline'), id: 'g2' }), 'deadline');
  fails(() => s.create({ ...GRANT, id: 'g3', fields: [{ id: 'class', type: 'text', level: 'instance' }] }), 'fields');
  fails(() => s.create({ ...GRANT, id: 'g4', fields: [{ id: 'x', type: 'colour', level: 'instance' }] }), 'fields');
  fails(() => s.create({ ...GRANT, id: 'g5', fields: [{ id: 'x', type: 'choice', level: 'both', options: ['a'] }] }), 'fields');
  fails(() => s.remove('grant'), null, 409);
  s.remove(a.id as string);
  s.remove('grant');
  assert.equal(s.get('grant'), null);
});

test('replacing keeps id and class, and a both-level value can come from the class', () => {
  const s = new Store();
  s.create({ ...without(GRANT, 'deadline'), fields: [...(GRANT.fields as Obj[]).slice(0, 2), { id: 'level', type: 'choice', level: 'both', required: true, options: [{ id: 'degree' }] }], level: 'degree' });
  const a = s.create({ class: 'grant', applicant: 'Ada', amount: 1 });
  const b = s.replace(a.id as string, { applicant: 'Ada L', amount: 2, level: 'degree' });
  assert.equal(b.class, 'grant');
  assert.equal(b.applicant, 'Ada L');
  fails(() => s.replace(a.id as string, { class: 'user' }), 'class');
  fails(() => s.replace('nope', {}), null, 404);
});

test('extends inherits fields and refs check the Concept they point to', () => {
  const s = new Store();
  s.create({ id: 'service', class: 'concept', extends: 'group', label: { es: 'Servicio' }, fields: [{ id: 'hours', type: 'text', level: 'instance' }] });
  const svc = s.create({ class: 'service', label: { es: 'Urbanismo' }, hours: '9-14', group: 'root' });
  fails(() => s.create({ class: 'service', hours: '9-14' }), 'label');
  s.create({ id: 'licence', class: 'concept', label: { es: 'Licencia' }, fields: [{ id: 'office', type: 'ref', level: 'instance', to: 'group' }] });
  s.create({ class: 'licence', office: svc.id });
  fails(() => s.create({ class: 'licence', office: 'admin' }), 'office');
  fails(() => s.create({ class: 'licence', group: 'admin' }), 'group');
  fails(() => s.replace('group', { label: { es: 'G' }, extends: 'service' }), 'extends');
});

test('passwords are stored hashed and never answered', () => {
  const s = new Store();
  const u = s.create({ class: 'user', name: 'ana', password: 'secret' });
  assert.equal(u.password, undefined);
  s.replace(u.id as string, { name: 'ana' });
  fails(() => s.create({ class: 'user', name: 'ana' }), 'name');
});

test('the dev server answers /api/objects', async () => {
  const server = createServer((req, res) => {
    void handleApi(req, res, new URL(req.url ?? '/', 'http://x')).then(ok => {
      if (!ok) res.writeHead(404).end();
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api/objects`;
  const json = { 'content-type': 'application/json' };
  try {
    assert.equal((await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ ...GRANT, id: 'grant-http' }) })).status, 201);
    const bad = await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ class: 'grant-http' }) });
    assert.equal(bad.status, 422);
    assert.equal(((await bad.json()) as { field: string }).field, 'applicant');
    const made = await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ class: 'grant-http', applicant: 'Ada', amount: 3 }) });
    const { id } = (await made.json()) as { id: string };
    const list = (await (await fetch(`${base}?class=grant-http`)).json()) as Obj[];
    assert.deepEqual(list.map(o => o.id), [id]);
    assert.equal(((await (await fetch(`${base}/${id}`)).json()) as Obj).applicant, 'Ada');
    assert.equal((await fetch(`${base}/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/${id}`)).status, 404);
  } finally {
    server.close();
  }
});
