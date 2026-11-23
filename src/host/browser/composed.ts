// A face made of its style's layout: (src/ui/dialect/composites.trb) is one thing to a screen reader: a group
// named by its text, wherever its layout shows that text. Kept apart from sync.ts so Node can test it.

type Marked = Pick<Element, 'setAttribute' | 'removeAttribute'>;

export function markComposed(node: Marked, text: string | null): void {
  node.setAttribute('role', 'group');
  if (text !== null && text !== '') node.setAttribute('aria-label', text);
  else node.removeAttribute('aria-label');
}
