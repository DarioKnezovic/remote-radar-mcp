import { BoardsJobSource, type Board } from '../board-source.js';
import type { HttpClient } from '../http.js';
import { normalizeGreenhouseResponse } from './normalize.js';

/**
 * Greenhouse Job Board API (https://docs.greenhouse.io/job-board.html): public, no auth
 * for GET. `content=true` adds the description, departments and offices. There's no
 * remote flag or employment type — only free-text location ("Remote, Canada; Remote,
 * United States", "Home based - EMEA").
 */
export function greenhouseJobsUrl(board: string): string {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
}

export function createGreenhouseSource(http: HttpClient, boards: readonly Board[]) {
  return new BoardsJobSource(
    { id: 'greenhouse', name: 'Greenhouse job boards', homepage: 'https://www.greenhouse.com' },
    boards,
    async (board) =>
      normalizeGreenhouseResponse(await http.getJson(greenhouseJobsUrl(board.board)), board).jobs,
  );
}
