import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeJob } from '../helpers.js';
import { BoardsJobSource, mapWithConcurrency } from '../../src/sources/board-source.js';
import { loadBoardsConfig, resolveBoardsFile } from '../../src/sources/boards-config.js';

describe('boards config', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'remote-radar-boards-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('ships a valid starter list', async () => {
    const file = await resolveBoardsFile({});
    expect(file.pathname).toMatch(/boards(\.default)?\.json$/);
    const config = await loadBoardsConfig(file);
    expect(config.greenhouse.length + config.lever.length + config.ashby.length).toBeGreaterThan(
      10,
    );
    expect(config.lever.map((board) => board.region)).not.toContain(undefined);
  });

  it('uses BOARDS_FILE when set, and fills defaults', async () => {
    const path = join(dir, 'mine.json');
    await writeFile(path, JSON.stringify({ lever: [{ board: 'acme', company: 'Acme' }] }));

    const file = await resolveBoardsFile({ BOARDS_FILE: path });
    expect(file.href).toBe(pathToFileURL(path).href);
    expect(await loadBoardsConfig(file)).toEqual({
      greenhouse: [],
      lever: [{ board: 'acme', company: 'Acme', region: 'global' }],
      ashby: [],
    });
  });

  it('rejects unsafe board tokens and explains why', async () => {
    const path = join(dir, 'bad.json');
    await writeFile(path, JSON.stringify({ ashby: [{ board: '../admin', company: 'X' }] }));
    await expect(loadBoardsConfig(pathToFileURL(path))).rejects.toThrow(/ashby\.0\.board/);
  });

  it('reports unreadable files', async () => {
    await expect(loadBoardsConfig(pathToFileURL(join(dir, 'missing.json')))).rejects.toThrow(
      /Cannot read boards config/,
    );
  });
});

describe('BoardsJobSource', () => {
  const info = {
    id: 'greenhouse',
    name: 'Greenhouse job boards',
    homepage: 'https://x.test',
  } as const;
  const boards = [
    { board: 'a', company: 'A' },
    { board: 'gone', company: 'Gone' },
    { board: 'b', company: 'B' },
  ];

  it('merges all boards and skips the ones that fail', async () => {
    const source = new BoardsJobSource(info, boards, (board) =>
      board.board === 'gone'
        ? Promise.reject(new Error('404 Not Found'))
        : Promise.resolve([makeJob({ company: board.company })]),
    );
    const jobs = await source.fetchJobs();
    expect(jobs.map((job) => job.company)).toEqual(['A', 'B']);
  });

  it('fails only when every board fails, naming each', async () => {
    const source = new BoardsJobSource(info, boards, (board) =>
      Promise.reject(new Error(`down ${board.board}`)),
    );
    await expect(source.fetchJobs()).rejects.toThrow(
      'Greenhouse job boards: every board failed (a: down a; gone: down gone; b: down b)',
    );
  });

  it('returns nothing for an empty board list', async () => {
    const source = new BoardsJobSource(info, [], () => Promise.reject(new Error('never')));
    expect(await source.fetchJobs()).toEqual([]);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, ms));
      active--;
      if (ms === 20) throw new Error('twenty');
      return ms * 2;
    });

    expect(peak).toBe(2);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : 'x'))).toEqual([
      60,
      20,
      'x',
      10,
      30,
    ]);
    expect(results.map((r) => r.item)).toEqual([30, 10, 20, 5, 15]);
  });
});
