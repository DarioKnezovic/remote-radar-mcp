import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { profileSchema, type Profile } from '../domain/profile.js';

export interface ProfileIssue {
  /** Dotted field path, e.g. "location.country_code"; "(root)" for the whole file. */
  path: string;
  message: string;
}

export type ProfileResult =
  | { ok: true; profile: Profile; file: string }
  | { ok: false; error: string; issues?: ProfileIssue[] };

export interface ProfileStore {
  load(): Promise<ProfileResult>;
}

/** A profile store that can also be written, e.g. from the web app's profile form. */
export interface WritableProfileStore extends ProfileStore {
  save(input: unknown): Promise<ProfileResult>;
}

/** Package root; resolves the same from `src/profile/` and `dist/profile/`. */
const PACKAGE_ROOT = new URL('../../', import.meta.url);

/** `PROFILE_FILE` if set, else the git-ignored `profile.json` in the project folder. */
export function resolveProfileFile(env: NodeJS.ProcessEnv = process.env): URL {
  return env.PROFILE_FILE
    ? pathToFileURL(resolve(env.PROFILE_FILE))
    : new URL('profile.json', PACKAGE_ROOT);
}

function toIssues(error: z.ZodError): ProfileIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }));
}

function describeIssues(issues: readonly ProfileIssue[]): string {
  return issues.map((i) => `${i.path}: ${i.message}`).join('; ');
}

/** Reads the file on every call, so edits to profile.json apply without a restart. */
export class FileProfileStore implements WritableProfileStore {
  constructor(private readonly file: URL) {}

  async load(): Promise<ProfileResult> {
    const path = fileURLToPath(this.file);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          ok: false,
          error: `No profile at ${path}. Copy profile.example.json to profile.json and fill it in.`,
        };
      }
      return {
        ok: false,
        error: `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = toIssues(parsed.error);
      return { ok: false, error: `Invalid profile ${path}: ${describeIssues(issues)}`, issues };
    }
    return { ok: true, profile: parsed.data, file: path };
  }

  /**
   * Validates and writes the profile. Nothing is written when it's invalid. The write
   * goes to a temporary file first, so a crash never leaves a half-written profile.
   */
  async save(input: unknown): Promise<ProfileResult> {
    const path = fileURLToPath(this.file);
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      const issues = toIssues(parsed.error);
      return { ok: false, error: `Invalid profile: ${describeIssues(issues)}`, issues };
    }
    const temp = `${path}.${String(process.pid)}.tmp`;
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(temp, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
      await rename(temp, path);
    } catch (error) {
      return {
        ok: false,
        error: `Cannot write ${path}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    return { ok: true, profile: parsed.data, file: path };
  }
}
