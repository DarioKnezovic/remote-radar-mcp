import { BoardsJobSource, type Board } from '../board-source.js';
import type { HttpClient } from '../http.js';
import { normalizeLeverResponse } from './normalize.js';

/**
 * Lever Postings API (https://github.com/lever/postings-api): public GET, no auth.
 * EU-hosted companies live on api.eu.lever.co. Only the read endpoints are used —
 * the API's application POST endpoint is never called (no auto-apply).
 *
 * Differences from the docs seen in live data (2026-10): `workplaceType` is "onsite"
 * (docs: "on-site"), and `createdAt` (ms) is present though undocumented.
 */
export type LeverBoard = Board & { region: 'global' | 'eu' };

export function leverPostingsUrl(board: LeverBoard): string {
  const host = board.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
  return `https://${host}/v0/postings/${encodeURIComponent(board.board)}?mode=json`;
}

export function createLeverSource(http: HttpClient, boards: readonly LeverBoard[]) {
  return new BoardsJobSource(
    { id: 'lever', name: 'Lever job boards', homepage: 'https://www.lever.co' },
    boards,
    async (board) =>
      normalizeLeverResponse(await http.getJson(leverPostingsUrl(board)), board).jobs,
  );
}
