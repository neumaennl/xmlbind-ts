import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import js from "@eslint/js";

export default defineConfig([
  js.configs.recommended,
  ...typescriptEslint.configs["flat/recommended"],
  vitest.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: {},

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
  // Promises must be awaited or handled; otherwise their errors are lost,
  // such as a failing assertion in withTmpDir(). The rule needs type
  // information from the projects that tsconfig.json references; the
  // configuration files of Vitest are in none of them.
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["vitest.config.ts", "vitest.setup.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
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
