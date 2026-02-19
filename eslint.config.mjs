import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import jestPlugin from "eslint-plugin-jest";
import globals from "globals";
import js from "@eslint/js";

export default defineConfig([
  js.configs.recommended,
  ...typescriptEslint.configs["flat/recommended"],
  jestPlugin.configs["flat/recommended"],
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: {},

      globals: {
        ...globals.node,
        ...globals.jest,
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

      "jest/expect-expect": [
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
  // Disallow .js and .cjs files (project uses ESM with .mjs and TypeScript)
  {
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: 'JavaScript (.js) and CommonJS (.cjs) files are not allowed. Use TypeScript (.ts) or ES modules (.mjs) instead.',
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
