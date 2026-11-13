import { configDefaults, defineConfig, type Plugin } from "vitest/config";
import ts from "typescript";
import { compilerTarget } from "./__tests__/test-utils/compiler-target.ts";

type DecoratorMode = "legacy" | "stage3";

/**
 * Converts the target of `tsconfig.target.json` to the value that
 * `ts.transpileModule` expects, so that the tests are compiled with the same
 * target as the build.
 */
function scriptTarget(): ts.ScriptTarget {
  const { options, errors } = ts.convertCompilerOptionsFromJson({ target: compilerTarget().target }, ".");
  if (errors.length > 0 || options.target === undefined) {
    throw new Error("tsconfig.target.json must set a valid target.");
  }
  return options.target;
}

const target = scriptTarget();

/**
 * Compiles TypeScript with `ts.transpileModule`, because Oxc (Vite 8,
 * Vitest 5) does not lower Stage 3 decorators. `enforce: "pre"` makes it run
 * before Vite's own transforms, so the decorators are compiled here.
 */
function typescriptTranspile(decoratorMode: DecoratorMode): Plugin {
  const legacy = decoratorMode === "legacy";
  return {
    name: `typescript-transpile-${decoratorMode}`,
    enforce: "pre",
    transform(code, id) {
      if (id.endsWith(".ts")) {
        const result = ts.transpileModule(code, {
          compilerOptions: {
            target,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: legacy,
            emitDecoratorMetadata: legacy,
            sourceMap: true,
          },
          fileName: id,
        });
        return {
          code: result.outputText,
          map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
        };
      }
    },
  };
}

/**
 * In GitHub Actions: annotations at the lines of failing tests. The job summary comes
 * from the report steps in ci.yml, so Vitest's own summary is off.
 */
const githubActionsReporter: ["github-actions", { jobSummary: { enabled: boolean } }] = [
  "github-actions",
  { jobSummary: { enabled: false } },
];

export default defineConfig({
  // TypeScript is compiled by the typescript-transpile plugin of each project.
  oxc: false,
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    globals: true,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        plugins: [typescriptTranspile("legacy")],
        test: {
          name: "legacy-decorators",
          provide: { decoratorMode: "legacy" },
        },
      },
      {
        extends: true,
        plugins: [typescriptTranspile("stage3")],
        test: {
          name: "stage3-decorators",
          provide: { decoratorMode: "stage3" },
          // The scripts use no decorators.
          exclude: [...configDefaults.exclude, "scripts/**"],
        },
      },
    ],
    reporters: [
      "default",
      ...(process.env.GITHUB_ACTIONS === "true" ? [githubActionsReporter] : []),
      [
        "junit",
        {
          outputFile: "test-results/vitest-junit.xml",
          suiteNameTemplate: "[{displayName}] {title}",
          classnameTemplate: "[{displayName}] {basename}",
          titleTemplate: "{title}",
        },
      ],
      [
        "json",
        {
          outputFile: "test-results/vitest-results.json",
        },
      ],
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "scripts/**/*.ts"],
      exclude: ["**/*.d.ts", "**/__tests__/**", "**/*.test.ts"],
      // json: the coverage of the changed files on pull requests (see "CI" in docs/testing.md)
      reporter: ["text", "json-summary", "json", "html"],
      // A run below these values fails (see "Coverage" in docs/testing.md)
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
