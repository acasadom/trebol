// --- rows painted in the role their data names -------------------------------------

import { K, form, isAnyString, isAnyWord, type Cell, type ObjectCell, type WordCell, type Sym } from '../../core/index.ts';
import { rowField } from '../rows.ts';
import { get } from './faces.ts';

/** The roles a row or a cell may be painted in, as the role of a face. */
const ROLES = new Set(['primary', 'accent', 'danger', 'success', 'warning', 'muted']);

/** The field a table, list, board or tree reads the role of each row from: `role-by tone`; or none. */
export function roleField(face: ObjectCell): Sym | null {
  const w = get(face, 'role-by');
  return w.t === K.Word || w.t === K.LitWord ? (w as WordCell).sym : null;
}

/**
 * The role a row names in a field: success, 'danger or "warning" (any case); anything else, none or a value
 * that is no role, paints nothing, since it is data, not something written in the layout.
 */
export function roleOf(row: Cell, field: Sym | null): string | null {
  if (field === null) return null;
  const v = rowField(row, field);
  if (!isAnyWord(v.t) && !isAnyString(v.t)) return null;
  const name = form(v).toLowerCase();
  return ROLES.has(name) ? name : null;
}

/** Paints an element in a role, or takes the role it had away. */
export function paintRole(e: HTMLElement, role: string | null): void {
  if (role === null) {
    if (e.dataset['tbRole'] !== undefined) delete e.dataset['tbRole'];
  } else if (e.dataset['tbRole'] !== role) e.dataset['tbRole'] = role;
}
