import type { Job } from '../../domain/job.js';
import { BoardsJobSource, mapWithConcurrency, type Board } from '../board-source.js';
import type { HttpClient } from '../http.js';
import { normalizeSmartRecruitersDetail, smartRecruitersPostingIds } from './normalize.js';

/**
 * SmartRecruiters Posting API (https://developers.smartrecruiters.com/docs/posting-api):
 * public GET, no auth. The postings list has no description and no link, so each posting
 * needs a second request for its detail. To keep that polite, only remote postings are
 * listed (`locationType=REMOTE`), and only the newest 100 per company (one page; the list
 * is sorted newest first). Hybrid and on-site postings are not fetched.
 *
 * The board token is the company identifier, which is case-sensitive: `Canva` in
 * `jobs.smartrecruiters.com/Canva`.
 */
const API = 'https://api.smartrecruiters.com/v1/companies';

/** Detail requests in flight per board; boards themselves also run a few at a time. */
const DETAIL_CONCURRENCY = 2;

export function smartRecruitersPostingsUrl(board: string): string {
  return `${API}/${encodeURIComponent(board)}/postings?limit=100&locationType=REMOTE`;
}

export function smartRecruitersPostingUrl(board: string, id: string): string {
  return `${API}/${encodeURIComponent(board)}/postings/${encodeURIComponent(id)}`;
}

async function fetchBoard(http: HttpClient, board: Board): Promise<Job[]> {
  const ids = smartRecruitersPostingIds(
    await http.getJson(smartRecruitersPostingsUrl(board.board)),
  );
  const results = await mapWithConcurrency(ids, DETAIL_CONCURRENCY, async (id) =>
    normalizeSmartRecruitersDetail(
      await http.getJson(smartRecruitersPostingUrl(board.board, id)),
      board,
    ),
  );
  const jobs: Job[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) jobs.push(result.value);
  }
  // A posting closed between the two requests is fine to skip; all of them failing isn't.
  const firstFailure = results.find((result) => result.status === 'rejected');
  if (jobs.length === 0 && firstFailure?.status === 'rejected') throw firstFailure.reason;
  return jobs;
}

export function createSmartRecruitersSource(http: HttpClient, boards: readonly Board[]) {
  return new BoardsJobSource(
    {
      id: 'smartrecruiters',
      name: 'SmartRecruiters job boards',
      homepage: 'https://www.smartrecruiters.com',
    },
    boards,
    (board) => fetchBoard(http, board),
  );
}
