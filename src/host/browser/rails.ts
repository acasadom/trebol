// rail: a column whose children go down a line, each with a mark on it, as the steps of something or what
// happened one after another. To a screen reader it is a list and each child an item of it.

type Attrs = Pick<Element, 'setAttribute' | 'removeAttribute' | 'getAttribute'>;
type Box = Attrs & { children: ArrayLike<Attrs> };

/** Marks a column on a rail as a list of its children, or takes the marks away when it is not one any more. */
export function markRail(box: Box, on: boolean): void {
  if (!on && box.getAttribute('data-tb-rail') === null) return;
  if (on) {
    box.setAttribute('role', 'list');
    box.setAttribute('data-tb-rail', '');
  } else {
    box.removeAttribute('role');
    box.removeAttribute('data-tb-rail');
  }
  for (let i = 0; i < box.children.length; i++) {
    const c = box.children[i]!;
    if (on) c.setAttribute('role', 'listitem');
    else if (c.getAttribute('role') === 'listitem') c.removeAttribute('role');
  }
}
