// named: a column that is one part of the page, named by its first text, heading or title, as the day of a
// timeline over what happened in it. A screen reader hears it as a group with that name. Kept apart from
// sync.ts so Node can test it.

type Attrs = Pick<Element, 'setAttribute' | 'removeAttribute' | 'getAttribute'> & { id: string; classList: { contains(c: string): boolean } };
type Box = Attrs & { children: ArrayLike<Attrs> };

const SAYS = ['tb-text', 'tb-heading', 'tb-title'];
let made = 0;

/** Marks a named column as a group named by its first text, or takes the marks away when it is not one any more. */
export function markNamed(box: Box, on: boolean): void {
  if (!on) {
    if (box.getAttribute('data-tb-named') === null) return;
    box.removeAttribute('data-tb-named');
    box.removeAttribute('aria-labelledby');
    if (box.getAttribute('role') === 'group') box.removeAttribute('role');
    return;
  }
  box.setAttribute('data-tb-named', '');
  // a rail is a list already, which a name names as well
  if (box.getAttribute('role') === null) box.setAttribute('role', 'group');
  let first: Attrs | null = null;
  for (let i = 0; i < box.children.length && first === null; i++) {
    const c = box.children[i]!;
    if (SAYS.some(s => c.classList.contains(s))) first = c;
  }
  if (first === null) {
    box.removeAttribute('aria-labelledby');
    return;
  }
  if (first.id === '') first.id = `tb-name-${++made}`;
  box.setAttribute('aria-labelledby', first.id);
}
