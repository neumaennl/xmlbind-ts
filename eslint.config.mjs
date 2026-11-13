import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import js from "@eslint/js";

export default defineConfig([
  // JavaScript modules, such as this file.
  {
    files: ["**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  // TypeScript. no-floating-promises reports promises that are neither awaited
  // nor handled, because their errors are lost, such as a failing assertion in
  // withTmpDir(). It needs type information from the projects that
  // tsconfig.json references; the configuration file of Vitest is in none of
  // them.
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, typescriptEslint.configs["flat/recommended"]],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: {
        projectService: { allowDefaultProject: ["vitest.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  // Tests and their helpers.
  {
    files: ["**/__tests__/**/*.ts"],
    extends: [vitest.configs.recommended],
    rules: {
      // Vitest provides its API as globals (globals: true in vitest.config.ts).
      "vitest/no-importing-vitest-globals": "error",
      "vitest/expect-expect": [
        "warn",
        {
          assertFunctionNames: [
            "expect*",
            "expectStringsOnConsecutiveLines",
            "expectStringsOnSameLine",
          ],
        },
      ],
    },
  },
  // Allow only .ts and .mjs files: the package is an ES module, so .js would
  // be ambiguous, and .cjs, .mts and .cts are not needed. Without this block,
  // ESLint would skip .mts and .cts files, because no other block matches them.
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: 'Only TypeScript (.ts) and ES module (.mjs) files are allowed; .js, .cjs, .mts and .cts files are not.',
        },
      ],
    },
  },
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/coverage/",
    "**/generated/",
    "**/.vscode/",
    "**/.test-results/",
    "**/test-results/",
  ]),
]);
