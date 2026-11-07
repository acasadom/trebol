// The built-in icons: 24 px outlines drawn with the current text color, so
// they follow the role of the face that shows them. `icon #search`,
// `button #plus "New"`, `field #search "Search"`.

const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16.5 16.5L21 21',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-up': 'M6 15l6-6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevrons-left': 'M11 6l-6 6 6 6M19 6l-6 6 6 6',
  'chevrons-right': 'M5 6l6 6-6 6M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4 21c0-4 3.5-7 8-7s8 3 8 7',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5v.5',
  warning: 'M12 3L2 20h20L12 3zM12 10v4M12 17v.5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z',
  door: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14.5 12v.5',
  building: 'M5 21V4h14v17M3 21h18M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-5h4v5',
  landmark: 'M3 21h18M5 18h14M12 3l9 5H3zM6 8v10M10 8v10M14 8v10M18 8v10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z',
  fireworks: 'M12 22v-9M12 3v3M5 7l2.5 2M19 7l-2.5 2M3.5 13h3M17.5 13h3M8 3.5l1 2.5M16 3.5l-1 2.5',
  coins: 'M9 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM15.5 8.3a6 6 0 1 1-7.2 7.2',
  book: 'M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 1h14v-3',
  scale: 'M12 4v17M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z',
  people: 'M9 5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6M16 5.3a3.5 3.5 0 0 1 0 6.4M18 14.5c2 .8 3.5 2.8 3.5 5.5',
  tree: 'M12 3l6 7h-3l4 5H5l4-5H6zM12 15v6',
  truck: 'M2 6h12v11H2zM14 10h4l4 4v3h-8zM6.5 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM17.5 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 8.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  filter: 'M4 5h16l-6 8v6l-4-2v-4L4 5z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5l-5.5 2.9 1-6.3L3 9.7l6.2-.9L12 3z',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  type: 'M5 7V4h14v3M12 4v16M9 20h6',
  lines: 'M4 6h16M4 12h16M4 18h10',
  rows: 'M3 5h18v6H3zM3 13h18v6H3z',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  heading: 'M6 5v14M18 5v14M6 12h12',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  'list-ordered': 'M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M4 14.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 4h3',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  banknote: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM6.5 10v4M17.5 10v4',
  'check-square': 'M4 4h16v16H4zM8 12l3 3 5-6',
  toggle: 'M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7zM16 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
  radio: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  dropdown: 'M3 7h18v10H3zM14 11l2 2 2-2',
  panel: 'M4 4h16v16H4zM4 9h16',
  columns: 'M3 5h7v14H3zM14 5h7v14h-7z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  tabs: 'M3 9h18v11H3zM3 9V5h7v4M10 5h6v4',
  pointer: 'M6 4l13 6-5.5 2L11 18z',
};

export const ICONS: readonly string[] = Object.keys(PATHS);

const SVG = 'http://www.w3.org/2000/svg';

/** An icon element, or null when the name is unknown. Icons are decorative unless labelled. */
export function iconNode(name: string, label: string | null = null): SVGSVGElement | null {
  const d = PATHS[name];
  if (d === undefined) return null;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'tb-icon');
  if (label === null) {
    svg.setAttribute('aria-hidden', 'true');
  } else {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  }
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
