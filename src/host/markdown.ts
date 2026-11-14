// The Markdown a rich text field keeps as its value: headings, paragraphs, bold,
// italic, links and lists. Parsed to a small tree that the host draws with its
// own nodes, so text from outside never becomes HTML.

export type Inline =
  | { k: 'text'; text: string }
  | { k: 'br' }
  | { k: 'b' | 'i'; kids: Inline[] }
  | { k: 'a'; href: string; kids: Inline[] };

export type Block =
  | { k: 'p'; kids: Inline[] }
  | { k: 'h'; level: number; kids: Inline[] }
  | { k: 'ul' | 'ol'; items: Inline[][] };

const HEADING = /^(#{1,3}) +(.*)$/;
const BULLET = /^[-*] +(.*)$/;
const NUMBER = /^\d+\. +(.*)$/;

export function parseMd(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') { i++; continue; }
    const h = HEADING.exec(line);
    if (h !== null) {
      out.push({ k: 'h', level: h[1]!.length, kids: parseInline(h[2]!) });
      i++;
      continue;
    }
    const marker = BULLET.test(line) ? BULLET : NUMBER.test(line) ? NUMBER : null;
    if (marker !== null) {
      const items: Inline[][] = [];
      for (let m = marker.exec(lines[i] ?? ''); m !== null; m = marker.exec(lines[i] ?? '')) {
        items.push(parseInline(m[1]!));
        i++;
      }
      out.push({ k: marker === BULLET ? 'ul' : 'ol', items });
      continue;
    }
    const text: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !HEADING.test(lines[i]!) && !BULLET.test(lines[i]!) && !NUMBER.test(lines[i]!)) {
      text.push(lines[i++]!);
    }
    out.push({ k: 'p', kids: parseInline(text.join('\n')) });
  }
  return out;
}

/** Where `mark` closes after `from`, skipping escapes; a run of stars closes at its end. */
function closing(s: string, mark: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (!s.startsWith(mark, i)) continue;
    if (mark === '*' && s[i + 1] === '*') { i++; continue; }
    if (mark === '**') while (s[i + 2] === '*') i++;
    return i;
  }
  return -1;
}

/** The `)` that ends a link, which may hold balanced ones: a(b).html */
function closingParen(s: string, from: number): number {
  let depth = 0;
  for (let i = from; i < s.length && s[i] !== '\n'; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && depth-- === 0) return i;
  }
  return -1;
}

function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const text = (t: string): void => {
    const last = out[out.length - 1];
    if (last?.k === 'text') last.text += t;
    else out.push({ k: 'text', text: t });
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '\\' && i + 1 < s.length) {
      text(s[i + 1]!);
      i += 2;
    } else if (c === '\n') {
      out.push({ k: 'br' });
      i++;
    } else if (c === '*') {
      const mark = s.startsWith('**', i) ? '**' : '*';
      const end = closing(s, mark, i + mark.length);
      if (end <= i + mark.length) {
        text(c);
        i++;
      } else {
        out.push({ k: mark === '**' ? 'b' : 'i', kids: parseInline(s.slice(i + mark.length, end)) });
        i = end + mark.length;
      }
    } else if (c === '[') {
      const end = closing(s, ']', i + 1);
      const close = end > 0 && s[end + 1] === '(' ? closingParen(s, end + 2) : -1;
      if (close < 0) {
        text(c);
        i++;
      } else {
        out.push({ k: 'a', href: s.slice(end + 2, close), kids: parseInline(s.slice(i + 1, end)) });
        i = close + 1;
      }
    } else {
      text(c);
      i++;
    }
  }
  return out;
}

function printInline(items: Inline[]): string {
  return items.map(x => {
    switch (x.k) {
      case 'text': return x.text.replace(/[\\*[\]]/g, '\\$&');
      case 'br': return '\n';
      case 'b': return `**${printInline(x.kids)}**`;
      case 'i': return `*${printInline(x.kids)}*`;
      case 'a': return `[${printInline(x.kids)}](${x.href})`;
    }
  }).join('');
}

/** A text that would read as a heading or a list keeps its meaning with an escape. */
function printText(items: Inline[]): string {
  return printInline(items).split('\n').map(line =>
    line.replace(/^(#{1,3} |- )/, '\\$1').replace(/^(\d+)\. /, '$1\\. ')).join('\n');
}

export function printMd(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.k) {
      case 'p': return printText(b.kids);
      case 'h': return `${'#'.repeat(b.level)} ${printInline(b.kids)}`;
      case 'ul': return b.items.map(x => `- ${printInline(x).replace(/\n/g, ' ')}`).join('\n');
      case 'ol': return b.items.map((x, i) => `${i + 1}. ${printInline(x).replace(/\n/g, ' ')}`).join('\n');
    }
  }).join('\n\n');
}

/** Markdown with plain text added at its end, in its last paragraph or a new one after a heading or list. */
export function appendText(src: string, text: string): string {
  const blocks = parseMd(src);
  const last = blocks[blocks.length - 1];
  if (last?.k === 'p') last.kids.push({ k: 'text', text });
  else blocks.push({ k: 'p', kids: [{ k: 'text', text }] });
  return printMd(blocks);
}

/** Only web and mail links open; anything else (javascript:...) is shown as plain text. */
export function safeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim());
}
