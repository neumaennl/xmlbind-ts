---
type: Testing Strategy
title: Testing
description: How xmlbind-ts is tested - running the tests, the two Vitest projects for legacy and Stage 3 decorators, the test utilities and resources, the kinds of tests, coverage, CI, and what the tests do not cover.
tags: [testing, vitest, decorators, coverage, ci]
status: draft
generated: { by: human:neumaennl, at: 2026-11-13T12:50:20Z }
sources:
  - id: manifest
    resource: ../package.json
    title: Package manifest (test scripts)
  - id: vitest-config
    resource: ../vitest.config.ts
    title: Vitest configuration
  - id: test-utils
    resource: ../__tests__/test-utils/index.ts
    title: Test utilities
  - id: compiler-target
    resource: ../__tests__/test-utils/compiler-target.ts
    title: Compiler target of the tests
  - id: decorator-mode
    resource: ../__tests__/test-utils/decorator-mode.ts
    title: Decorator mode of a test run
  - id: scripts-helpers
    resource: ../scripts/__tests__/testHelpers.ts
    title: Helpers for the tests of the scripts
  - id: eslint
    resource: ../eslint.config.mjs
    title: ESLint configuration
  - id: ci
    resource: ../.github/workflows/ci.yml
    title: CI workflow
---

# Purpose

This document describes how xmlbind-ts and its scripts are tested, and what the tests do not cover. Version 3 is reimplemented in parts ([ADR 001](architecture/001-reimplementation.md)); each part writes the tests of the behavior it implements and adds them here. Until then, only the scripts have tests. The rules for writing tests are in the [development guidelines](development-guidelines.md#tests).

# Running the tests

| Command | What it does |
|---|---|
| `npm test` | builds the library and type-checks the scripts (`pretest`), then runs all tests once |
| `npm test -- --coverage` | the same, with a coverage report; fails if the coverage is below the thresholds |
| `npx vitest run scripts/__tests__/node-version.test.ts` | runs one test file, without `pretest` |
| `npx vitest` | runs the tests in watch mode |

The scripts are defined in `package.json`.[^manifest] The tests import the library from `src/`, not from `dist/`.

# Two Vitest projects

The configuration defines two projects, which run the same test files:[^vitest-config]

| Project | Decorators |
|---|---|
| `legacy-decorators` | legacy, with `experimentalDecorators` and `emitDecoratorMetadata` |
| `stage3-decorators` | Stage 3 |

Every behavior that depends on decorators is therefore tested in both modes, because both kinds stay supported ([ADR 001](architecture/001-reimplementation.md#principles)). The `stage3-decorators` project leaves out the tests of the scripts, which use no decorators.

Both projects compile TypeScript with their own plugin, which calls `ts.transpileModule` for each file with the target of `tsconfig.target.json` (see [Build and release](build-and-release.md#typescript-configurations)) and the decorator options of the project.[^compiler-target] Vite's own compiler, Oxc, is switched off (`oxc: false`), because it does not lower Stage 3 decorators. The plugin only removes types; it does not type-check.

Further settings:

- `include` is `**/__tests__/**/*.test.ts`, which covers `__tests__/` and `scripts/__tests__/`.
- `globals: true` makes `describe`, `test`, `expect` and `vi` available without imports, and `restoreMocks: true` restores mocks after each test.
- Besides the console output, the results are written to `test-results/vitest-junit.xml` and `test-results/vitest-results.json`.

`__tests__/test-utils/decorator-mode.ts` exports the mode of the current project (`decoratorMode`, `emitsDecoratorMetadata`), so that a test can expect what the mode can deliver, for example types from `design:type` only with legacy decorators. `detectDecoratorMode()` checks how a file was actually compiled, so that a test can verify that each project compiles in its mode.[^decorator-mode]

# Utilities and resources

`__tests__/test-utils/index.ts` exports the helpers for the tests of the library:[^test-utils]

| Helper | Purpose |
|---|---|
| `withTmpDir(callback)` | runs the callback with a new temporary folder and deletes it afterwards; returns a promise, which the test must await; ESLint reports a call without `await` (see [Lint](build-and-release.md#lint)) |
| `compilerTarget()` | returns `target` and `lib` of `tsconfig.target.json`, for the projects that tests compile with `tsc` |
| `expectStringsOnSameLine(line, strings)` | checks that strings occur on one line in this order |
| `expectStringsOnConsecutiveLines(text, strings)` | checks that strings occur on successive lines in this order |
| `decoratorMode`, `emitsDecoratorMetadata`, `detectDecoratorMode()` | see [Two Vitest projects](#two-vitest-projects) |

The two assertion helpers are registered with the ESLint rule `vitest/expect-expect`, so tests that use only them are not reported as tests without an assertion.[^eslint]

`scripts/__tests__/testHelpers.ts` stubs `fetch` and provides fixtures of the Node.js release schedule, the Node.js releases and the versions of `@types/node` for the tests of the scripts.[^scripts-helpers]

Larger XSD and XML snippets are kept in `__tests__/test-resources/`:

| File | Content |
|---|---|
| `XMLSchema.xsd` | the XSD schema for schemas, the largest real-world schema in the tests |
| `compositor-occurrences.xsd` | compositors and groups with `minOccurs` and `maxOccurs` |
| `example.xsd` | a small example schema |

# Kinds of tests

- **Script tests** check the Node.js version scripts with stubbed network access.

The parts of version 3 add the kinds of tests they need. The tests of 2.x at the tag `2.4.0` are a list of cases to look at, not code to port ([ADR 001](architecture/001-reimplementation.md#how-the-branch-starts)).

# Coverage

Coverage is measured with V8 (`@vitest/coverage-v8`) for the TypeScript files in `src/` and `scripts/`, except type declarations, test files and `__tests__` folders. Both Vitest projects contribute to the same report. The reports are a text table in the output, `coverage-summary.json` and `coverage-final.json` for CI (see [CI](#ci)), and an HTML report (`coverage/index.html`), all in `coverage/`.[^vitest-config]

The threshold is 85% for lines, statements, functions and branches (`coverage.thresholds` in `vitest.config.ts`). A run with coverage below one of them fails, also in CI.

# CI

CI runs the tests with coverage on every push to `main` or `reimplementation` and every pull request into `main`, after linting and building.[^ci] [Build and release](build-and-release.md#ci) describes the workflow.

- **Report.** The job summary has a section "Vitest" with the test report that `dorny/test-reporter` creates from the JUnit file, with the tests per file and the message of each failing test. `dorny/test-reporter` writes it into the job summary of the run (`use-actions-summary`, its default since version 2), not as a check of its own. The coverage report follows it.
- **Coverage.** `davelosert/vitest-coverage-report-action` shows the totals against the thresholds, which it reads from `vitest.config.ts` (`vite-config-path`), and the coverage of the files changed in a pull request, with their uncovered lines. On pull requests from this repository it also keeps one comment with this report up to date; pull requests from forks get none, because their workflow runs have no write access. For the files of a pull request, Vitest writes the coverage reporter `json` (`coverage/coverage-final.json`) besides `json-summary`.[^vitest-config]
- **Annotations.** In GitHub Actions, Vitest also adds its `github-actions` reporter, which marks the line of each failing test in the run and in the changed files of a pull request. Its own job summary is off, because the report steps write one.[^vitest-config]

# What the tests do not cover

- **Type errors in tests.** The plugin removes types without checking them, `pretest` type-checks only the scripts, and nothing runs `tsconfig.test.json` (see [Tests are not type-checked](known-issues.md#tests-are-not-type-checked)).
- **Round trips of real documents.** There is no corpus of real-world documents whose round trip is compared with the source (see [Round trips are not tested with real documents](known-issues.md#round-trips-are-not-tested-with-real-documents)).

[^manifest]: Package manifest (test scripts)

[^vitest-config]: Vitest configuration

[^test-utils]: Test utilities

[^compiler-target]: Compiler target of the tests

[^decorator-mode]: Decorator mode of a test run

[^scripts-helpers]: Helpers for the tests of the scripts

[^ci]: CI workflow

[^eslint]: ESLint configuration
