// XML in the shape of Red's community codec: every node is three values,
// name, content and attributes.
//
//   <factura id="7"><cliente>Ana &amp; Co</cliente><linea/></factura>
//   [factura [cliente [none "Ana & Co" none] none  linea [] none] #(id: "7")]
//
// A text is `none "text" none`, so `foreach [name content atts]` walks any
// content. Names are words when they read as one (as load-json keys) and
// strings otherwise (`"fe:Facturae"`); attributes are a map, or none when
// there are none. Entities and CDATA load as text; comments, processing
// instructions, the declaration, the DOCTYPE and the spaces only between tags
// are left out. The parser keeps its own stack, so deep XML never touches the
// JS stack limit; there is no DOMParser, so it works the same everywhere.

import { K } from '../kinds.ts';
import { intern, spell } from '../symbols.ts';
import {
  NONE, TRUE, string, block, map, fromCodePoints,
  type Cell, type BlockCell, type StringCell, type WordCell,
} from '../values.ts';
import { fieldText } from './csv.ts';
import { native, value, fail } from './define.ts';
import { pushAll } from '../arrays.ts';

const used = (c: Cell): boolean => c === TRUE;
const NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** A tag or attribute name: a word when it reads as one. */
function nameCell(n: string): Cell {
  return NAME.test(n) ? { t: K.Word, sym: intern(n), bind: null } : string(n);
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Text with its entities replaced; one XML does not know is kept as written. */
function decode(s: string): string {
  return s.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[e] ?? all;
  });
}

interface Open { name: string; atts: Cell; out: Cell[]; at: number }

/** Parses XML text into a block of nodes; returns an error message when it is not well formed. */
export function parseXml(src: string): Cell[] | string {
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = src.length;
  const stack: Open[] = [];
  const top: Cell[] = [];
  let text = '';
  const lineAt = (p: number): number => {
    let l = 1;
    for (let k = 0; k < p; k++) if (src.charCodeAt(k) === 10) l++;
    return l;
  };
  const out = (): Cell[] => (stack.length > 0 ? stack[stack.length - 1]!.out : top);
  const flush = () => {
    // spaces only between tags are layout, not text
    if (text !== '' && /\S/.test(text)) out().push(NONE, string(text), NONE);
    text = '';
  };
  const skipTo = (end: string, what: string): number | string => {
    const k = src.indexOf(end, i);
    return k < 0 ? `${what} on line ${lineAt(i)} never ends` : k + end.length;
  };
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      text += decode(src.slice(i));
      break;
    }
    text += decode(src.slice(i, lt));
    i = lt;
    let to: number | string;
    if (src.startsWith('<!--', i)) {
      to = skipTo('-->', 'a comment');
    } else if (src.startsWith('<![CDATA[', i)) {
      to = skipTo(']]>', 'a CDATA section');
      if (typeof to === 'number') text += src.slice(i + 9, to - 3);
    } else if (src.startsWith('<?', i)) {
      to = skipTo('?>', 'a processing instruction');
    } else if (src.startsWith('<!', i)) {
      // a DOCTYPE, with its internal subset in brackets
      const open = src.indexOf('[', i);
      const close = src.indexOf('>', i);
      if (open >= 0 && close >= 0 && open < close) {
        i = open;
        to = skipTo(']', 'a DOCTYPE');
        if (typeof to === 'number') {
          i = to;
          to = skipTo('>', 'a DOCTYPE');
        }
      } else {
        to = skipTo('>', 'a DOCTYPE');
      }
    } else if (src[i + 1] === '/') {
      const m = /^<\/([^\s>]+)\s*>/.exec(src.slice(i, i + 512));
      if (m === null) return `a closing tag on line ${lineAt(i)} is not written right`;
      flush();
      const open = stack.pop();
      if (open === undefined) return `</${m[1]}> on line ${lineAt(i)} closes no tag`;
      if (open.name !== m[1]) return `</${m[1]}> on line ${lineAt(i)} closes <${open.name}> of line ${lineAt(open.at)}`;
      out().push(nameCell(open.name), block(open.out), open.atts);
      to = i + m[0].length;
    } else {
      const m = /^<([^\s/>=]+)/.exec(src.slice(i, i + 512));
      if (m === null) return `a < on line ${lineAt(i)} starts no tag; write it &lt;`;
      flush();
      const name = m[1]!;
      let k = i + m[0].length;
      const atts: Cell[] = [];
      for (;;) {
        while (k < n && /\s/.test(src[k]!)) k++;
        if (k >= n) return `<${name}> on line ${lineAt(i)} never ends`;
        if (src[k] === '>' || src.startsWith('/>', k)) break;
        const a = /^([^\s/>=]+)\s*=\s*("[^"]*"|'[^']*')/.exec(src.slice(k, k + 4096));
        if (a === null) return `an attribute of <${name}> on line ${lineAt(k)} is not written right`;
        atts.push(nameCell(a[1]!), string(decode(a[2]!.slice(1, -1))));
        k += a[0].length;
      }
      const attsCell = atts.length === 0 ? NONE : map(atts);
      if (src[k] === '/') {
        out().push(nameCell(name), block([]), attsCell);
        to = k + 2;
      } else {
        stack.push({ name, atts: attsCell, out: [], at: i });
        to = k + 1;
      }
    }
    if (typeof to === 'string') return to;
    i = to;
  }
  const open = stack.pop();
  if (open !== undefined) return `<${open.name}> on line ${lineAt(open.at)} is never closed`;
  flush();
  return top;
}

native('load-xml', '["Reads XML text into a block of nodes, each its name, content and attributes; a text is none, the text and none." source [string! binary!]]', (_t, f) => {
  const x = f.args[0]!;
  const src = x.t === K.Binary
    ? new TextDecoder().decode(new Uint8Array(x.s.data.slice(x.i)))
    : fromCodePoints((x as StringCell).s.data, (x as StringCell).i);
  const r = parseXml(src);
  return typeof r === 'string' ? fail('syntax', 'xml', r) : value(block(r));
});

const escapeText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string): string => escapeText(s).replace(/"/g, '&quot;');

/** A name as XML writes it; null when the value cannot be one. */
function nameText(c: Cell): string | null {
  if (c.t === K.Word || c.t === K.SetWord || c.t === K.LitWord) return spell((c as WordCell).sym);
  if (c.t === K.String) return fromCodePoints(c.s.data, c.i);
  return null;
}

/** none as a value, or the word none as a block written in code has it. */
const isNone = (c: Cell): boolean => c.t === K.None || (c.t === K.Word && spell(c.sym).toLowerCase() === 'none');

/** Attributes from a map, an object or a block of names and values; none values are left out. */
function attsText(c: Cell): string | null {
  const pairs: Cell[] = [];
  if (isNone(c)) return '';
  if (c.t === K.Map) pushAll(pairs, c.s.data);
  else if (c.t === K.Block) pushAll(pairs, c.s.data.slice(c.i));
  else if (c.t === K.Object) c.ctx.keys.forEach((k, j) => pairs.push({ t: K.Word, sym: k, bind: null }, c.ctx.vals[j]!));
  else return null;
  let s = '';
  for (let k = 0; k + 1 < pairs.length; k += 2) {
    const name = nameText(pairs[k]!);
    if (name === null) return null;
    if (!isNone(pairs[k + 1]!)) s += ` ${name}="${escapeAttr(fieldText(pairs[k + 1]!))}"`;
  }
  return s;
}

/** The XML text of a block of nodes, or an error message when a node is not name, content and attributes. */
export function writeXml(nodes: Cell[]): { xml: string } | { error: string } {
  let s = '';
  // the nodes still to write, from where each block is, and the closing tags between them
  const work: Array<{ nodes: Cell[]; at: number } | string> = [{ nodes, at: 0 }];
  while (work.length > 0) {
    const w = work[work.length - 1]!;
    if (typeof w === 'string' || w.at >= w.nodes.length) {
      work.pop();
      if (typeof w === 'string') s += w;
      continue;
    }
    if (w.at + 3 > w.nodes.length) return { error: 'every node is three values: name, content and attributes' };
    const [name, content, atts] = [w.nodes[w.at]!, w.nodes[w.at + 1]!, w.nodes[w.at + 2]!];
    w.at += 3;
    if (isNone(name)) {
      s += escapeText(fieldText(content));
      continue;
    }
    const tag = nameText(name);
    if (tag === null) return { error: `a node's name is a word or a string, not ${fieldText(name)}` };
    const a = attsText(atts);
    if (a === null) return { error: `the attributes of <${tag}> are a map, an object or a block` };
    const inner = content.t === K.Block ? content.s.data.slice(content.i) : isNone(content) ? [] : null;
    if (inner === null) {
      // a value as content is its text
      s += `<${tag}${a}>${escapeText(fieldText(content))}</${tag}>`;
    } else if (inner.length === 0) {
      s += `<${tag}${a}/>`;
    } else {
      s += `<${tag}${a}>`;
      work.push(`</${tag}>`, { nodes: inner, at: 0 });
    }
  }
  return { xml: s };
}

native('to-xml', '["Writes XML text from a block of nodes, each its name, content and attributes, as load-xml gives them." nodes [block!] /declaration "Start with the <?xml ...?> line a whole document needs"]', (_t, f) => {
  const b = f.args[0] as BlockCell;
  const r = writeXml(b.s.data.slice(b.i));
  if ('error' in r) return fail('script', 'bad-xml', r.error);
  return value(string((used(f.args[1]!) ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '') + r.xml));
});
