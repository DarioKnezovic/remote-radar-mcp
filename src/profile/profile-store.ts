import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { profileSchema, type Profile } from '../domain/profile.js';

export type ProfileResult =
  { ok: true; profile: Profile; file: string } | { ok: false; error: string };

export interface ProfileStore {
  load(): Promise<ProfileResult>;
}

/** Package root; resolves the same from `src/profile/` and `dist/profile/`. */
const PACKAGE_ROOT = new URL('../../', import.meta.url);

/** `PROFILE_FILE` if set, else the git-ignored `profile.json` in the project folder. */
export function resolveProfileFile(env: NodeJS.ProcessEnv = process.env): URL {
  return env.PROFILE_FILE
    ? pathToFileURL(resolve(env.PROFILE_FILE))
    : new URL('profile.json', PACKAGE_ROOT);
}

/** Reads the file on every call, so edits to profile.json apply without a restart. */
export class FileProfileStore implements ProfileStore {
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
      const issues = parsed.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      );
      return { ok: false, error: `Invalid profile ${path}: ${issues.join('; ')}` };
    }
    return { ok: true, profile: parsed.data, file: path };
  }
}
