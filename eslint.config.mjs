import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // 会话/内测临时产物（同 .gitignore /.tmp/）——本地 scratch 脚本不应触发 lint。
    ".tmp/**",
  ]),
  // C2 guard: app routes and the shared assistant context must go through the
  // DB adapter (@/lib/db/repo), never the in-memory store directly. The store
  // remains importable only from src/lib/db/repo.ts and from *.test.ts files.
  {
    files: [
      "src/app/**/*.ts",
      "src/app/**/*.tsx",
      "src/lib/assistant-context.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/store",
              message:
                "App / SSR / API code must import from @/lib/db/repo, not the in-memory store.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
