import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";
import js from "@eslint/js";

/** The most lines that the callback of a single test may have. */
const MAX_LINES_PER_TEST = 50;

/**
 * Limits the length of single tests: the callbacks of `test()`, `test.each()` and the like.
 * `max-lines-per-function` cannot do this, because it also counts the `describe` callbacks that hold the tests.
 */
const maxLinesPerTest = {
  meta: {
    type: "suggestion",
    messages: { tooLong: "Test has {{lines}} lines. Maximum allowed is {{max}}." },
    schema: [],
  },
  create(context) {
    const isTestCall = (callee) => {
      let node = callee;
      while (node.type === "CallExpression" || node.type === "MemberExpression") {
        node = node.type === "CallExpression" ? node.callee : node.object;
      }
      return node.type === "Identifier" && node.name === "test";
    };
    return {
      CallExpression(node) {
        if (!isTestCall(node.callee)) return;
        const callback = node.arguments.find(
          (arg) => arg.type === "ArrowFunctionExpression" || arg.type === "FunctionExpression"
        );
        if (!callback) return;
        const lines = callback.loc.end.line - callback.loc.start.line + 1;
        if (lines > MAX_LINES_PER_TEST) {
          context.report({ node: callback, messageId: "tooLong", data: { lines, max: MAX_LINES_PER_TEST } });
        }
      },
    };
  },
};

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
      jsdoc,
      tsdoc,
      style: { rules: { "max-ternary-lines": maxTernaryLines } },
    },
    settings: {
      jsdoc: { mode: "typescript" },
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

      // TSDoc (see "TSDoc" in docs/development-guidelines.md): tsdoc/syntax checks
      // the syntax of the comments, the rules of jsdoc check that functions,
      // methods and classes have them, with every parameter, the return value and
      // the errors thrown.
      "tsdoc/syntax": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: false,
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: false,
            MethodDefinition: true,
          },
        },
      ],
      // Destructured parameters are described at their type, because TSDoc has no
      // dotted parameter names such as `options.name`.
      "jsdoc/require-param": ["error", { checkDestructured: false }],
      "jsdoc/check-param-names": ["error", { checkDestructured: false }],
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-check": "error",
      "jsdoc/require-throws": "error",

      // Size limits (see "Code size" in docs/development-guidelines.md).
      // Blank lines and comments count as well.
      "max-lines": ["error", { max: 500 }],
      "max-lines-per-function": ["error", { max: 120 }],
    },
  },
  // Tests and their helpers.
  {
    files: ["**/__tests__/**/*.ts"],
    extends: [vitest.configs.recommended],
    plugins: {
      tests: { rules: { "max-lines-per-test": maxLinesPerTest } },
    },
    rules: {
      // Empty mock implementations, such as mockImplementation(() => {}), are intended.
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
      // Test cases use test(), not it() (see "Tests" in docs/development-guidelines.md).
      // The defaults require it() inside describe(). Setting fn alone would be enough, because
      // withinDescribe then takes its value, but both are set to make the intent obvious.
      "vitest/consistent-test-it": ["error", { fn: "test", withinDescribe: "test" }],
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
  // Size limits of test files (see "Code size" in
  // docs/development-guidelines.md). max-lines-per-function would count the
  // describe callbacks that hold the tests, so the local rule limits the single
  // tests instead. Helpers of the tests keep the limits of other code.
  {
    files: ["**/__tests__/**/*.test.ts"],
    rules: {
      "max-lines": ["error", { max: 1000 }],
      "max-lines-per-function": "off",
      "tests/max-lines-per-test": "error",
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
