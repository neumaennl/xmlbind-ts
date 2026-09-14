import { defineConfig } from "vitest/config";
import ts from "typescript";

export default defineConfig({
  ssr: {
    noExternal: [/@neumaennl\/xmlbind-ts/],
  },
  plugins: [
    {
      name: "typescript-transpile",
      transform(code, id) {
        if (id.endsWith(".ts") || id.endsWith(".tsx") || id.endsWith(".mts")) {
          const result = ts.transpileModule(code, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
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
    },
  ],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.test.ts"],
    globals: true,
    restoreMocks: true,
    reporters: [
      "default",
      [
        "junit",
        {
          outputFile: "test-results/vitest-junit.xml",
          suiteNameTemplate: "{title}",
          classnameTemplate: "{basename}",
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
