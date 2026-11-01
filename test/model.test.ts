// The object model (src/model/model.trb): Concepts defined in Trebol, their
// schema, languages, and objects kept in the fake store of the dev server.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mold, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startModel, runSource, type Host } from '../src/host/index.ts';
import { Store, handleObjects } from '../tools/objects.ts';

let host: Host;
let server: Server;

before(async () => {
  const store = new Store();
  server = createServer((req, res) => {
    void handleObjects(store, req, res, new URL(req.url ?? '/', 'http://x')).then(ok => {
      if (!ok) res.writeHead(404).end();
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startModel(host);
  await ev(`store/url: "http://localhost:${(server.address() as AddressInfo).port}/api/objects"`);
  await ev(GRANT);
});

after(() => server.close());

async function ev(src: string): Promise<string> {
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return assert.fail(`${src}\n  raised: ${form(errorField(e as ObjectCell, 'message'))}`);
  }
}

async function raises(src: string): Promise<string> {
  try {
    await runSource(host, src);
  } catch (e) {
    return form(errorField(e as ObjectCell, 'message'));
  }
  return assert.fail(`${src}\n  did not raise`);
}

const GRANT = `
  concept grant [
      label [es "Solicitud de beca" en "Grant application"]
      fields [
          applicant: text [label [es "Solicitante" en "Applicant"] required summary]
          amount: money [label [es "Importe" en "Amount"] level instance required]
          level: choice [
              label [es "Nivel de estudios" en "Level of studies"]
              level both
              options [degree [es "Grado" en "Degree"] master [es "Máster" en "Master"]]
          ]
          deadline: number [label "Plazo" level class]
      ]
      views [
          apply [
              panel #personal [field applicant  field level]
              panel #documents [field amount]
          ]
      ]
      deadline: 30
      level: "degree"
  ]
`;

test('a Concept produces its schema', async () => {
  const schema = JSON.parse(form(await runSource(host, 'to-json schema-of grant'))) as Record<string, unknown>;
  assert.deepEqual(schema, {
    id: 'grant', class: 'concept', version: 1, deadline: 30, level: 'degree',
    label: { es: 'Solicitud de beca', en: 'Grant application' },
    fields: [
      { id: 'applicant', type: 'text', level: 'instance', label: { es: 'Solicitante', en: 'Applicant' }, required: true, summary: true },
      { id: 'amount', type: 'money', level: 'instance', label: { es: 'Importe', en: 'Amount' }, required: true },
      {
        id: 'level', type: 'choice', level: 'both', label: { es: 'Nivel de estudios', en: 'Level of studies' },
        options: [{ id: 'degree', label: { es: 'Grado', en: 'Degree' } }, { id: 'master', label: { es: 'Máster', en: 'Master' } }],
      },
      { id: 'deadline', type: 'number', level: 'class', label: { es: 'Plazo' } },
    ],
  });
});

test('bad definitions are errors that say where', async () => {
  assert.match(await raises('concept x [fields [a: colour]]'), /unknown field type colour/);
  assert.match(await raises('concept x [fields [a: text b: text a: number]]'), /defined twice/);
  assert.match(await raises('concept x [fields [id: text]]'), /reserved/);
  assert.match(await raises('concept x [fields [a: text [lable "A"]]]'), /cannot read field a/);
});

test('texts show in the active language and fall back to the main one', async () => {
  assert.equal(await ev('i18n/language: \'en  tr grant/label'), '"Grant application"');
  assert.equal(await ev('tr select field-of grant/fields "deadline" \'label'), '"Plazo"');
  assert.equal(await ev('i18n/texts/save: translated [es "Guardar" en "Save"]  tr \'save'), '"Save"');
  assert.equal(await ev('i18n/language: \'es  tr \'save'), '"Guardar"');
  assert.equal(await ev('tr \'unknown-word'), '"unknown-word"');
});

test('class and both-level values fall back to the class, instance values do not', async () => {
  assert.equal(await ev('a: make map! [class "grant" applicant "Ada" amount $1200]  value-of a \'deadline'), '30');
  assert.equal(await ev('value-of a \'level'), '"degree"');
  assert.equal(await ev('a/level: "master"  value-of a \'level'), '"master"');
  assert.equal(await ev('value-of make map! [class "grant"] \'label'), 'none');
});

test('the gate: a Concept is stored, and its objects are saved and read back', async () => {
  assert.equal(await ev('c: save-concept grant  c/id'), '"grant"');
  // views travel as text and come back as a block
  assert.equal(await ev('c: load-concept "grant"  first c/views'), 'apply');
  assert.equal(await ev('a: create-object make map! [class "grant" applicant "Ada" amount $1200.50]  a/amount'), '$1200.50');
  assert.equal(await ev('b: get-object a/id  b/applicant'), '"Ada"');
  assert.equal(await ev('value-of b \'deadline'), '30');
  assert.equal(await ev('b/applicant: "Ada L"  update-object b  select get-object b/id \'applicant'), '"Ada L"');
  assert.equal(await ev('length? list-objects grant'), '1');
  assert.equal(await ev('e: try [create-object make map! [class "grant" amount $1]]  reduce [e/field e/status]'), '["applicant" 422]');
  assert.equal(await ev('e/message'), '"applicant is required"');
  assert.equal(await ev('delete-object b  get-object b/id'), 'none');
  assert.equal(await ev('save-concept concept meeting [label "Reunión" fields [on: date]]  select create-object make map! [class "meeting" on: 1-Nov-2026] \'on'), '1-Nov-2026');
  // the store keeps the schema: change the Concept and save it again
  assert.equal(await ev('grant/deadline: 45  save-concept grant  select get-object "grant" \'deadline'), '45');
});
