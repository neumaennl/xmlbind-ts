import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import jestPlugin from "eslint-plugin-jest";
import globals from "globals";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      parserOptions: {},

      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    plugins: {
      "@typescript-eslint": typescriptEslint,
      jest: jestPlugin,
    },

    extends: compat.extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:jest/recommended"
    ),

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
