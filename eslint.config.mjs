import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import js from "@eslint/js";

/** The most lines that a conditional expression (`a ? b : c`) may span. */
const MAX_TERNARY_LINES = 3;

/**
 * Limits conditional expressions to a few lines; a longer one is easier to read as `if`/`else`
 * (see "Code quality" in docs/development-guidelines.md).
 */
const maxTernaryLines = {
  meta: {
    type: "suggestion",
    messages: { tooLong: "Conditional expression spans {{lines}} lines. Maximum allowed is {{max}}; use if/else instead." },
    schema: [],
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        const lines = node.loc.end.line - node.loc.start.line + 1;
        if (lines > MAX_TERNARY_LINES) {
          context.report({ node, messageId: "tooLong", data: { lines, max: MAX_TERNARY_LINES } });
        }
      },
    };
  },
};

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
  // TypeScript, with the strict and stylistic rules of typescript-eslint that
  // need type information. They take it from the projects that tsconfig.json
  // references; the configuration file of Vitest is in none of them. Among
  // them, no-floating-promises reports promises that are neither awaited nor
  // handled, because their errors are lost, such as a failing assertion in
  // withTmpDir().
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,
      typescriptEslint.configs["flat/strict-type-checked"],
      typescriptEslint.configs["flat/stylistic-type-checked"],
    ],
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
    plugins: {
      style: { rules: { "max-ternary-lines": maxTernaryLines } },
    },

    rules: {
      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Numbers in messages are fine; other types, such as undefined, are not.
      // The options of the strict preset are repeated, because options given
      // here replace them.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],

      "@typescript-eslint/explicit-function-return-type": "error",

      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // Leaves files with decorators alone while emitDecoratorMetadata is on,
      // so it does not break the metadata of the decorators.
      "@typescript-eslint/consistent-type-imports": "error",

      // `x as unknown` and `const x: unknown` bypass type checks.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'TSAsExpression[typeAnnotation.type="TSUnknownKeyword"], VariableDeclarator[id.typeAnnotation.typeAnnotation.type="TSUnknownKeyword"]',
          message: "Avoid `unknown` in type assertions and variable-type annotations. If unavoidable, add eslint-disable-next-line with a justification.",
        },
      ],

      "style/max-ternary-lines": "error",
    },
  },
  // Tests and their helpers.
  {
    files: ["**/__tests__/**/*.ts"],
    extends: [vitest.configs.recommended],
    rules: {
      // Empty mock implementations, such as mockImplementation(() => {}), are intended.
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
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
