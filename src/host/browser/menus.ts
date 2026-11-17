// --- menus ---------------------------------------------------------------------------

import { K, type Cell, type ObjectCell, type BlockCell } from '../../core/index.ts';
import { get, str, flag, iconName, icon } from './faces.ts';
import { fire, el } from './mount.ts';
import { seenKeys } from './events.ts';

/** The open menus, outermost first. */
export const menus: HTMLElement[] = [];
/** Where focus goes back when the menus close. */
export let menuOpener: HTMLElement | null = null;

export function closeMenus(from = 0, refocus = true): void {
  for (const mn of menus.splice(from)) {
    mn.hidePopover?.();
    mn.remove();
  }
  if (from === 0) {
    menuOpener?.setAttribute('aria-expanded', 'false');
    if (!menuOpener?.hasAttribute('aria-haspopup')) menuOpener?.removeAttribute('aria-expanded');
    if (refocus) menuOpener?.focus();
    menuOpener = null;
    document.removeEventListener('pointerdown', outsideMenu, true);
  } else {
    (menus[from - 1]?.querySelector('[aria-expanded="true"]') as HTMLElement | null)?.setAttribute('aria-expanded', 'false');
  }
}

export function outsideMenu(ev: PointerEvent): void {
  if (!menus.some(mn => mn.contains(ev.target as Node))) closeMenus(0, false);
}

export function menuItems(mn: HTMLElement): HTMLElement[] {
  return Array.from(mn.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]'));
}

export interface MenuEntry {
  text: string;
  icon?: string | null;
  divider?: boolean;
  danger?: boolean;
  sub?: MenuEntry[];
  run?: () => void;
}

/** A menu block of the dialect as menu entries; choosing one runs ui-menu. */
export function trebolEntries(face: ObjectCell, items: BlockCell, row: Cell): MenuEntry[] {
  return (items.s.data.slice(items.i).filter(x => x.t === K.Object) as ObjectCell[]).map(item => {
    const sub = get(item, 'items');
    return {
      text: str(item, 'text') ?? '',
      icon: iconName(item),
      divider: flag(item, 'divider'),
      sub: sub.t === K.Block ? trebolEntries(face, sub as BlockCell, row) : undefined,
      danger: flag(item, 'danger'),
      run: () => void fire('ui-menu', face, item, row),
    };
  });
}

/** Opens a menu at x, y; level > 0 is a submenu. */
export function openMenu(entries: MenuEntry[], x: number, y: number, opener: HTMLElement, level = 0): void {
  closeMenus(level, false);
  if (level === 0) {
    menuOpener = opener;
    if (opener.hasAttribute('aria-haspopup')) opener.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outsideMenu, true);
  }
  const mn = el('div', 'tb-menu');
  mn.setAttribute('role', 'menu');
  mn.setAttribute('popover', 'manual');
  const label = opener.getAttribute('aria-label') ?? opener.textContent;
  if (label) mn.setAttribute('aria-label', label.trim());
  for (const item of entries) {
    if (item.divider) {
      const d = el('div', 'tb-menu-divider');
      d.setAttribute('role', 'separator');
      mn.append(d);
      continue;
    }
    const b = el('button', item.danger ? 'tb-menu-item tb-danger' : 'tb-menu-item');
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('role', 'menuitem');
    const svg = item.icon ? icon(item.icon) : null;
    const text = el('span');
    text.textContent = item.text;
    b.append(svg ?? el('span', 'tb-menu-gap'), text);
    const sub = item.sub;
    if (sub !== undefined) {
      b.setAttribute('aria-haspopup', 'menu');
      b.setAttribute('aria-expanded', 'false');
      const chevron = icon('chevron-right');
      if (chevron !== null) b.append(chevron);
      const openSub = (): void => {
        const r = b.getBoundingClientRect();
        openMenu(sub, r.right - 4, r.top - 5, b, level + 1);
        b.setAttribute('aria-expanded', 'true');
      };
      b.addEventListener('click', openSub);
      b.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') { ev.preventDefault(); openSub(); } });
    } else {
      b.addEventListener('click', () => {
        closeMenus();
        item.run?.();
      });
    }
    b.addEventListener('pointerenter', () => b.focus());
    mn.append(b);
  }
  mn.addEventListener('keydown', ev => {
    seenKeys.add(ev);
    const list = menuItems(mn);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const n = list.length;
    const to = ev.key === 'ArrowDown' ? (at + 1) % n : ev.key === 'ArrowUp' ? (at - 1 + n) % n
      : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1;
    if (to >= 0) {
      ev.preventDefault();
      list[to]?.focus();
    } else if (ev.key === 'Escape' || (ev.key === 'ArrowLeft' && level > 0)) {
      ev.preventDefault();
      ev.stopPropagation();
      if (level > 0) { closeMenus(level); opener.focus(); } else closeMenus();
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      closeMenus();
    } else if (ev.key.length === 1 && /\S/.test(ev.key)) {
      // type a letter to jump to the next item that starts with it
      const k = ev.key.toLowerCase();
      const next = [...list.slice(at + 1), ...list.slice(0, at + 1)].find(b => b.textContent?.trim().toLowerCase().startsWith(k));
      next?.focus();
    }
  });
  // keep the icon column only when some item has an icon
  if (mn.querySelector('.tb-menu-item > svg:first-child') === null) mn.querySelectorAll('.tb-menu-gap').forEach(g => g.remove());
  // in the top layer, so it shows above an open dialog
  document.body.append(mn);
  mn.showPopover?.();
  const r = mn.getBoundingClientRect();
  mn.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  mn.style.top = `${Math.max(8, y + r.height > innerHeight - 8 ? y - r.height : y)}px`;
  menus.push(mn);
  menuItems(mn)[0]?.focus();
}

