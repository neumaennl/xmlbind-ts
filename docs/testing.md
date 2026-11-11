---
type: Testing Strategy
title: Testing
description: How the library and the generator are tested - running the tests, the two Vitest projects for legacy and Stage 3 decorators, the test utilities and resources, the kinds of tests, coverage, CI, and what the tests do not cover.
tags: [testing, vitest, decorators, coverage, ci]
status: stable
generated: { by: human:neumaennl, at: 2026-11-11T13:05:00Z }
verified: { by: human:neumaennl, at: 2026-11-11T13:12:15Z }
sources:
  - id: manifest
    resource: ../package.json
    title: Package manifest (test scripts)
  - id: vitest-config
    resource: ../vitest.config.mts
    title: Vitest configuration
  - id: vitest-setup
    resource: ../vitest.setup.ts
    title: Vitest setup file
  - id: test-utils
    resource: ../__tests__/test-utils/index.ts
    title: Test utilities
  - id: generated-runtime
    resource: ../__tests__/test-utils/generated-runtime.ts
    title: Helpers for tests of generated classes
  - id: compiler-target
    resource: ../__tests__/test-utils/compiler-target.ts
    title: Compiler target of the tests
  - id: decorator-mode
    resource: ../__tests__/test-utils/decorator-mode.ts
    title: Decorator mode of a test run
  - id: scripts-helpers
    resource: ../scripts/__tests__/testHelpers.ts
    title: Helpers for the tests of the scripts
  - id: cli-integration
    resource: ../__tests__/cli-integration.test.ts
    title: Integration tests of the packed package
  - id: xmlschema-test
    resource: ../__tests__/xsd-generator-xmlschema.test.ts
    title: Tests of the classes generated from XMLSchema.xsd
  - id: upstream-tests
    resource: ../__tests__/upstream-behavior.test.ts
    title: Tests of upstream behavior
  - id: eslint
    resource: ../eslint.config.mjs
    title: ESLint configuration
  - id: ci
    resource: ../.github/workflows/ci.yml
    title: CI workflow
---

# Purpose

This document describes how the library, the generator and the scripts are tested, and what the tests do not cover. The rules for writing tests are in the [development guidelines](development-guidelines.md#tests).

# Running the tests

| Command | What it does |
|---|---|
| `npm test` | builds the library and type-checks the scripts (`pretest`), then runs all tests once |
| `npm test -- --coverage` | the same, with a coverage report; fails if the coverage is below the thresholds |
| `npx vitest run __tests__/marshalling.test.ts` | runs one test file, without `pretest` |
| `npx vitest` | runs the tests in watch mode |

The scripts are defined in `package.json`.[^manifest] The tests import the library from `src/`, not from `dist/`; only the integration tests of the packed package use the build.

# Two Vitest projects

The configuration defines two projects, which run the same test files:[^vitest-config]

| Project | Decorators |
|---|---|
| `legacy-decorators` | legacy, with `experimentalDecorators` and `emitDecoratorMetadata` |
| `stage3-decorators` | Stage 3 |

Every behavior of the decorators and the marshalling is therefore tested in both modes (see [Decorators](decorators.md#legacy-and-stage-3-decorators)). The `stage3-decorators` project leaves out the tests of the scripts, which use no decorators, and `cli-integration.test.ts`, which runs `npm pack` and does not depend on how Vitest compiles decorators.

Both projects compile TypeScript with their own plugin, which calls `ts.transpileModule` for each file with the target of `tsconfig.target.json` (see [Build and release](build-and-release.md#typescript-configurations)) and the decorator options of the project.[^compiler-target] Vite's own compiler, Oxc, is switched off (`oxc: false`), because it does not lower Stage 3 decorators. The plugin only removes types; it does not type-check.

Further settings:

- `include` is `**/__tests__/**/*.test.ts`, which covers `__tests__/` and `scripts/__tests__/`.
- `globals: true` makes `describe`, `test`, `expect` and `vi` available without imports, and `restoreMocks: true` restores mocks after each test.
- `vitest.setup.ts` imports `reflect-metadata` before the tests.[^vitest-setup]
- `ssr.noExternal` lets Vite compile `@neumaennl/xmlbind-ts` itself, so that generated classes in temporary folders, which import the package by name, get the library from `src/`.
- Besides the console output, the results are written to `test-results/vitest-junit.xml` and `test-results/vitest-results.json`.

`__tests__/test-utils/decorator-mode.ts` exports the mode of the current project (`decoratorMode`, `emitsDecoratorMetadata`), so that a test can expect what the mode can deliver, for example types from `design:type` only with legacy decorators. `detectDecoratorMode()` checks how a file was actually compiled; `stage3-decorators.test.ts` uses it to verify that each project compiles in its mode.[^decorator-mode]

# Utilities and resources

`__tests__/test-utils/index.ts` exports the helpers for the tests of the library and the generator:[^test-utils]

| Helper | Purpose |
|---|---|
| `withTmpDir(callback)` | runs the callback with a new temporary folder and deletes it afterwards; returns a promise, which the test awaits (see [Tests do not wait for `withTmpDir()`](known-issues.md#tests-do-not-wait-for-withtmpdir)) |
| `setupGeneratedRuntime(outDir, xsds)` | generates classes from XSD texts into a folder and adds a stub package `@neumaennl/xmlbind-ts` there that re-exports `src/index.ts` |
| `loadGeneratedClasses(outDir, names)` | imports generated classes by name |
| `compilerTarget()` | returns `target` and `lib` of `tsconfig.target.json`, for the projects that tests compile with `tsc` |
| `expectStringsOnSameLine(line, strings)` | checks that strings occur on one line in this order |
| `expectStringsOnConsecutiveLines(text, strings)` | checks that strings occur on successive lines in this order |
| `firstLine(text)` | returns the first line that is not empty, such as the start tag of the root element in the output of `marshal()` |
| `decoratorMode`, `emitsDecoratorMetadata`, `detectDecoratorMode()` | see [Two Vitest projects](#two-vitest-projects) |

`__tests__/test-utils/note.ts` exports `Note`, a bound class with the string attribute `title` and the string element `text`, for tests of how values are read and written. `index.ts` does not export it, so that importing the helpers does not register a class in the metadata registry.

The stub package of `setupGeneratedRuntime()` makes generated classes import the library from `src/`, like the other tests.[^generated-runtime] The two assertion helpers are registered with the ESLint rule `vitest/expect-expect`, so tests that use only them are not reported as tests without an assertion.[^eslint]

`scripts/__tests__/testHelpers.ts` stubs `fetch` and provides fixtures of the Node.js release schedule, the Node.js releases and the versions of `@types/node` for the tests of the scripts.[^scripts-helpers]

Larger XSD and XML snippets are kept in `__tests__/test-resources/`:

| File | Content |
|---|---|
| `XMLSchema.xsd` | the XSD schema for schemas, the largest real-world schema in the tests |
| `compositor-occurrences.xsd` | compositors and groups with `minOccurs` and `maxOccurs` |
| `example.xsd` | a small example schema |

# Kinds of tests

- **Library tests** define decorated classes in the test and check the metadata, `unmarshal()` and `marshal()`, mostly with round trips.
- **Generator tests** generate classes from XSD texts into a temporary folder and check the generated source; some also load the classes with `loadGeneratedClasses()` and unmarshal documents with them.
- **The XSD schema for schemas** is generated and type-checked with `tsc --noEmit`.[^xmlschema-test] `schema-roundtrip.test.ts` unmarshals and marshals `XMLSchema.xsd` and `example.xsd` with their generated classes and compares how often each element occurs before and after, not their order or text.
- **CLI integration tests** pack the package with `npm pack`, install it into a consumer project and run its `xsd2ts`. One test type-checks the generated classes in an ES module project; the other compiles them as CommonJS with legacy decorators and `emitDecoratorMetadata` and round-trips a document with Node.js.[^cli-integration]
- **Script tests** check the Node.js version scripts with stubbed network access.
- **Upstream tests** in `upstream-behavior.test.ts` pin problems of dependencies that xmlbind-ts works around or documents. Each names the upstream issue and fails when a new version of the dependency fixes the problem; the known issue of the same upstream issue says what to change then (see [Development guidelines](development-guidelines.md#documentation)).[^upstream-tests]

# Coverage

Coverage is measured with V8 (`@vitest/coverage-v8`) for the TypeScript files in `src/` and `scripts/`, except type declarations, test files and `__tests__` folders. Both Vitest projects contribute to the same report. The reports are a text table in the output, `coverage-summary.json` and `coverage-final.json` for CI (see [CI](#ci)), and an HTML report (`coverage/index.html`), all in `coverage/`.[^vitest-config]

The threshold is 85% for lines, statements, functions and branches (`coverage.thresholds` in `vitest.config.mts`). A run with coverage below one of them fails, also in CI. Branch coverage is only a little above its threshold, which is enough because new and changed code is tested anyway (see [Development guidelines](development-guidelines.md#tests)).

# CI

CI runs the tests with coverage on every push to `main` and every pull request into it, after linting and building.[^ci] [Build and release](build-and-release.md#ci) describes the workflow.

- **Report.** The job summary has a section "Vitest" with the test report that `dorny/test-reporter` creates from the JUnit file, with the tests per file and the message of each failing test. `dorny/test-reporter` writes it into the job summary of the run (`use-actions-summary`, its default since version 2), not as a check of its own. The coverage report follows it.
- **Coverage.** `davelosert/vitest-coverage-report-action` shows the totals against the thresholds, which it reads from `vitest.config.mts` (`vite-config-path`), and the coverage of the files changed in a pull request, with their uncovered lines. On pull requests from this repository it also keeps one comment with this report up to date; pull requests from forks get none, because their workflow runs have no write access. For the files of a pull request, Vitest writes the coverage reporter `json` (`coverage/coverage-final.json`) besides `json-summary`.[^vitest-config]
- **Annotations.** In GitHub Actions, Vitest also adds its `github-actions` reporter, which marks the line of each failing test in the run and in the changed files of a pull request. Its own job summary is off, because the report steps write one.[^vitest-config]

# What the tests do not cover

- **Type errors in tests.** The plugin removes types without checking them, `pretest` type-checks only the scripts, and nothing runs `tsconfig.test.json` (see [Tests are not type-checked](known-issues.md#tests-are-not-type-checked)).
- **Generated classes as native ES modules.** The generated classes are run through Vite's module loader, or compiled as CommonJS, but never compiled with `tsc` and run as native ES modules. This hides that generated classes with circular imports fail to load with `emitDecoratorMetadata` (see [Known issues](known-issues.md#generated-classes-with-circular-references-fail-to-load-with-emitdecoratormetadata)).
- **Round trips of real documents in general.** The round-trip tests check selected features; there is no corpus of real-world documents whose round trip is compared with the source (see [Round trips are not tested with real documents](known-issues.md#round-trips-are-not-tested-with-real-documents)).

[^manifest]: Package manifest (test scripts)

[^vitest-config]: Vitest configuration

[^vitest-setup]: Vitest setup file

[^test-utils]: Test utilities

[^generated-runtime]: Helpers for tests of generated classes

[^compiler-target]: Compiler target of the tests

[^decorator-mode]: Decorator mode of a test run

[^scripts-helpers]: Helpers for the tests of the scripts

[^cli-integration]: Integration tests of the packed package

[^xmlschema-test]: Tests of the classes generated from XMLSchema.xsd

[^upstream-tests]: Tests of upstream behavior

[^ci]: CI workflow

[^eslint]: ESLint configuration
