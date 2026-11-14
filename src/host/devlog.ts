// What the app does, told to the dev tools of trebol dev (devtools.ts). Each
// hook does nothing until the dev tools start and set it, so the host calls
// them freely: in a built page, in tests and in Node they are never set.

import type { Cell, ObjectCell } from '../core/index.ts';

export const devLog = {
  /** The host ran a UI event function (ui-click, ui-input...) on a face. */
  event: (_fn: string, _face: ObjectCell, _args: Cell[]): void => {},
  /** A request ended: its status, or null and why it failed. */
  request: (_verb: string, _url: string, _status: number | null, _ms: number, _problem: string | null): void => {},
  /** A toast, an error nobody caught or a warning (a cycle of reactions). */
  note: (_kind: 'toast' | 'error' | 'warning', _text: string): void => {},
  /** The faces on the page were repainted. */
  repainted: (): void => {},
};
