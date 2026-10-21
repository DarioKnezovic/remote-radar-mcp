import { BoardsJobSource, type Board } from '../board-source.js';
import type { HttpClient } from '../http.js';
import { normalizeRecruiteeResponse } from './normalize.js';

/**
 * Recruitee Careers Site API (https://docs.recruitee.com/reference/offers): public GET, no
 * auth. Returns every published offer with description, requirements, remote/hybrid/on-site
 * flags, the countries a remote offer is open to, and the salary range when the company
 * shows it. The board token is the company's subdomain (`{board}.recruitee.com`), also for
 * companies whose careers site runs on their own domain.
 */
export function recruiteeOffersUrl(board: string): string {
  return `https://${encodeURIComponent(board)}.recruitee.com/api/offers/`;
}

export function createRecruiteeSource(http: HttpClient, boards: readonly Board[]) {
  return new BoardsJobSource(
    { id: 'recruitee', name: 'Recruitee job boards', homepage: 'https://recruitee.com' },
    boards,
    async (board) =>
      normalizeRecruiteeResponse(await http.getJson(recruiteeOffersUrl(board.board)), board).jobs,
  );
}
