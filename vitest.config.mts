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
      if (id.endsWith(".ts") || id.endsWith(".tsx") || id.endsWith(".mts")) {
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

export default defineConfig({
  // TypeScript is compiled by the typescript-transpile plugin of each project.
  oxc: false,
  ssr: {
    noExternal: [/@neumaennl\/xmlbind-ts/],
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
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
          // Runs `npm pack`, which rebuilds dist/, and does not depend on how
          // Vitest compiles decorators. The scripts use no decorators.
          exclude: [
            ...configDefaults.exclude,
            "**/__tests__/cli-integration.test.ts",
            "scripts/**",
          ],
        },
      },
    ],
    reporters: [
      "default",
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
      include: ["src/**"],
      reporter: ["json-summary", "text", "lcov"],
    },
  },
});
