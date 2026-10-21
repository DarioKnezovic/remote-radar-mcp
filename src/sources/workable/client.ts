import { BoardsJobSource, type Board } from '../board-source.js';
import type { HttpClient } from '../http.js';
import { normalizeWorkableResponse } from './normalize.js';

/**
 * Workable jobs widget API: public GET, no auth. It's what Workable's embeddable careers
 * widget reads; Workable's full API needs a company token. `details=true` adds the
 * description. There's a remote flag (`telecommuting`) but no hybrid flag and no salary.
 * The board token is the account's subdomain (`apply.workable.com/{board}`).
 *
 * Workable rate-limits through Cloudflare (HTTP 429, "error code: 1015") after a few dozen
 * quick requests, so keep the board list to companies you actually follow.
 */
export function workableWidgetUrl(board: string): string {
  return `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(board)}?details=true`;
}

export function createWorkableSource(http: HttpClient, boards: readonly Board[]) {
  return new BoardsJobSource(
    { id: 'workable', name: 'Workable job boards', homepage: 'https://www.workable.com' },
    boards,
    async (board) =>
      normalizeWorkableResponse(await http.getJson(workableWidgetUrl(board.board)), board).jobs,
  );
}
