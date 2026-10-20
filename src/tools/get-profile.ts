import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ProfileStore } from '../profile/profile-store.js';
import { toolError, toolResult } from './shared.js';

export function registerGetProfile(server: McpServer, profiles: ProfileStore): void {
  server.registerTool(
    'get_profile',
    {
      title: 'Get profile',
      description:
        "Returns the user's local profile (skills by level, location, citizenship, languages, what they're looking for, and achievement stories). Use it to judge fit or to draft a tailored application for the user to review and send themselves.",
      inputSchema: {},
      outputSchema: {
        profile: z.record(z.string(), z.unknown()).describe('Contents of profile.json.'),
        file: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const result = await profiles.load();
      if (!result.ok) return toolError(result.error);
      return toolResult({ profile: result.profile, file: result.file });
    },
  );
}
