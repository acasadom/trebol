// Whether a node is on a narrow screen: the width of the screen it is on, the page's or a device
// frame's, as the theme's `@container tb-screen` rules read it.

/** The widest a narrow screen is, in CSS pixels; the theme's rules use the same. */
export const NARROW = 640;

export function narrowAt(node: Element): boolean {
  const screen = node.closest<HTMLElement>('.tb-device-screen') ?? document.body;
  return screen.clientWidth <= NARROW;
}
