// A JavaScript module for the import tests.

export function addUp(a, b) { return a + b; }

export const shout = s => s.toUpperCase() + '!';

export async function later(value) { return { got: value, items: [1, 2.5, 'x', null, true] }; }

export function nothing() {}

export function fails() { throw new Error('it broke'); }

export async function rejects() { throw new Error('it said no'); }

export function described(file) { return file; }
described.spec = '["Gives back what it is given." file [file! string!]]';

export const version = '1.2';
export const limits = { low: 1, high: 9 };
