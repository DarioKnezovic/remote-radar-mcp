import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const boardSchema = z.object({
  board: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]+$/, 'board token may only contain letters, digits, ".", "_", "-"'),
  company: z.string().trim().min(1),
});

export const boardsConfigSchema = z.object({
  $comment: z.string().optional(),
  greenhouse: z.array(boardSchema).default([]),
  lever: z
    .array(
      boardSchema.extend({
        /** Lever hosts EU customers on a separate API (api.eu.lever.co). */
        region: z.enum(['global', 'eu']).default('global'),
      }),
    )
    .default([]),
  ashby: z.array(boardSchema).default([]),
});
export type BoardsConfig = z.infer<typeof boardsConfigSchema>;

/** Package root; resolves the same from `src/sources/` and `dist/sources/`. */
const PACKAGE_ROOT = new URL('../../', import.meta.url);

async function exists(url: URL): Promise<boolean> {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * `BOARDS_FILE` if set, else your git-ignored `boards.json`, else the committed
 * `boards.default.json` starter list.
 */
export async function resolveBoardsFile(env: NodeJS.ProcessEnv = process.env): Promise<URL> {
  if (env.BOARDS_FILE) return pathToFileURL(resolve(env.BOARDS_FILE));
  const own = new URL('boards.json', PACKAGE_ROOT);
  return (await exists(own)) ? own : new URL('boards.default.json', PACKAGE_ROOT);
}

export async function loadBoardsConfig(file: URL): Promise<BoardsConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read boards config ${file.pathname}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const parsed = boardsConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid boards config ${file.pathname}: ${issues.join('; ')}`);
  }
  return parsed.data;
}
