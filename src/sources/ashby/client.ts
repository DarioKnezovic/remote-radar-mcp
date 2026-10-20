import { BoardsJobSource, type Board } from '../board-source.js';
import type { HttpClient } from '../http.js';
import { normalizeAshbyResponse } from './normalize.js';

/**
 * Ashby public job posting API
 * (https://developers.ashbyhq.com/docs/public-job-posting-api): public GET, no auth.
 * `publishedAt` is when the job was *last* published, so long-open roles can look old.
 * Unlisted jobs (`isListed: false`, reachable only by direct link) are skipped.
 */
export function ashbyJobBoardUrl(board: string): string {
  return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`;
}

export function createAshbySource(http: HttpClient, boards: readonly Board[]) {
  return new BoardsJobSource(
    { id: 'ashby', name: 'Ashby job boards', homepage: 'https://www.ashbyhq.com' },
    boards,
    async (board) =>
      normalizeAshbyResponse(await http.getJson(ashbyJobBoardUrl(board.board)), board).jobs,
  );
}
