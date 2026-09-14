import { defineConfig } from "vitest/config";
import typescript from "@rollup/plugin-typescript";
import ts from "typescript";

export default defineConfig({
  ssr: {
    noExternal: [/@neumaennl\/xmlbind-ts/],
  },
  plugins: [
    {
      name: "transpile-tmp-ts",
      transform(code, id) {
        if (id.includes("/tmp/") && id.endsWith(".ts")) {
          const result = ts.transpileModule(code, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
            },
          });
          return { code: result.outputText, map: null };
        }
      },
    },
    typescript({
      tsconfig: "./tsconfig.test.json",
      compilerOptions: {
        rewriteRelativeImportExtensions: false,
      },
    }),
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
      reporter: ["json-summary", "text", "lcov"],
    },
  },
});
