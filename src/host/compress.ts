// compress and decompress, as in R3 and Red: gzip, zlib or raw deflate, done
// by the platform's CompressionStream (browsers and Node have it). It works
// on a stream, so both wait for the result as a fetch does.

import {
  K, native, value, binary, text, spell, canon, makeError, throwError,
  type Cell, type StringCell, type WordCell,
} from '../core/index.ts';

const FORMATS: Record<string, CompressionFormat> = { gzip: 'gzip', zlib: 'deflate', deflate: 'deflate-raw' };

function format(method: Cell): CompressionFormat | null {
  return FORMATS[spell(canon((method as WordCell).sym)).toLowerCase()] ?? null;
}

const bytesOf = (v: Cell): Uint8Array => v.t === K.Binary
  ? new Uint8Array(v.s.data.slice(v.i))
  : new TextEncoder().encode(text(v as StringCell));

async function through(bytes: Uint8Array, stream: TransformStream<BufferSource, Uint8Array>): Promise<Cell> {
  const out = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer();
  return binary([...new Uint8Array(out)]);
}

native('compress', '["Compresses bytes, or text as UTF-8, into a binary." data [binary! string!] method [word!] "gzip, zlib or deflate"]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  const fmt = format(f.args[1]!);
  if (fmt === null) return throwError('script', 'bad-method', 'compress takes gzip, zlib or deflate');
  f.phase = 1;
  return { k: 'await', p: through(bytesOf(f.args[0]!), new CompressionStream(fmt)) };
});

native('decompress', '["The bytes that compress was given." data [binary!] method [word!] "gzip, zlib or deflate"]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  const fmt = format(f.args[1]!);
  if (fmt === null) return throwError('script', 'bad-method', 'decompress takes gzip, zlib or deflate');
  f.phase = 1;
  const name = spell((f.args[1] as WordCell).sym);
  const p = through(bytesOf(f.args[0]!), new DecompressionStream(fmt)).catch(() => {
    throw makeError('script', 'bad-compression', `the data is not ${name} compressed`);
  });
  return { k: 'await', p };
});
