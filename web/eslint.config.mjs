import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const config = [
  { ignores: ['.next/', 'next-env.d.ts'] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'remote-radar-mcp/app',
              allowTypeImports: true,
              message:
                "Import values from 'remote-radar-mcp/domain'; the runtime is loaded by lib/radar.ts (getRadar), never bundled.",
            },
          ],
        },
      ],
    },
  },
  prettier,
];

export default config;
