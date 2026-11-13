// The bike workshop's server of the UI tutorial (docs/ui/09-server.md): a small
// JSON API that lives inside the page, so the live examples talk to a server
// even where the documentation is only files.
//
//   GET    /api/bookings        every booking: id, customer, bike, due
//   POST   /api/bookings        takes {customer, bike, due}; 201 with the new booking,
//                               422 with {"errors": {field: message}} when it refuses it
//   DELETE /api/bookings/:id    204; 404 for a booking it does not have
//
// installWorkshop puts it in front of a fetch: requests to /api/ get its answers,
// any other goes on. Each page (each live frame) has its own, starting with the same
// two bookings, and every answer takes a moment, as a real server's would.
// Loaded as a script in a browser, it installs itself in the page.

const DELAY_MS = 400;

interface Booking { id: number; customer: string; bike: string; due: string }

interface Answer { status: number; body: unknown }

function seed(): Booking[] {
  return [
    { id: 1, customer: 'Ada Lovelace', bike: 'Road', due: '2026-11-11' },
    { id: 2, customer: 'Grace Hopper', bike: 'City', due: '2026-11-12' },
  ];
}

/** What the workshop says to a request, with the bookings it keeps. */
export function answer(bookings: Booking[], method: string, path: string, body: unknown): Answer {
  path = path.replace(/\/$/, '');
  if (path === '/api/bookings' && method === 'GET') return { status: 200, body: bookings };
  if (path === '/api/bookings' && method === 'POST') {
    const b = (body ?? {}) as Record<string, unknown>;
    const errors: Record<string, string> = {};
    const customer = typeof b.customer === 'string' ? b.customer.trim() : '';
    const bike = typeof b.bike === 'string' ? b.bike : '';
    const due = typeof b.due === 'string' ? b.due : '';
    if (customer === '') errors.customer = 'Who is the bike for?';
    if (bike === '') errors.bike = 'Which bike is it?';
    const day = /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T00:00:00Z`) : null;
    if (day === null || Number.isNaN(day.getTime())) errors.due = 'When should it be ready?';
    else if (day.getUTCDay() === 0) errors.due = 'The workshop is closed on Sundays';
    if (Object.keys(errors).length > 0) return { status: 422, body: { errors } };
    const booking = { id: Math.max(0, ...bookings.map(x => x.id)) + 1, customer, bike, due };
    bookings.push(booking);
    return { status: 201, body: booking };
  }
  const m = /^\/api\/bookings\/(\d+)$/.exec(path);
  if (m !== null && method === 'DELETE') {
    const i = bookings.findIndex(x => x.id === Number(m[1]));
    if (i < 0) return { status: 404, body: { error: 'No such booking' } };
    bookings.splice(i, 1);
    return { status: 204, body: null };
  }
  return { status: 404, body: { error: 'Nothing here' } };
}

/** Puts a new workshop in front of `target.fetch`; gives back what undoes it. */
export function installWorkshop(target: { fetch: typeof fetch }, base: string): () => void {
  const bookings = seed();
  const pass = target.fetch;
  target.fetch = async (input, init) => {
    const req = new Request(new URL(input instanceof Request ? input.url : String(input), base), init);
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return pass(input, init);
    const text = await req.text();
    let body: unknown = null;
    try { body = text === '' ? null : JSON.parse(text); } catch { /* not JSON: the server finds nothing in it */ }
    const a = answer(bookings, req.method, url.pathname, body);
    await new Promise(r => setTimeout(r, DELAY_MS));
    return a.status === 204
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } });
  };
  return () => { target.fetch = pass; };
}

if (typeof window !== 'undefined') installWorkshop(window, location.href);
