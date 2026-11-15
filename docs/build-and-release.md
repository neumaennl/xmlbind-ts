---
type: Build
title: Build and release
description: How the package is built, linted, packaged and published - the npm scripts, the TypeScript configurations, the module format and the package contents, GitHub Packages, the Node.js version and its scripts, CI, Dependabot, and the changelog.
tags: [build, npm, packaging, github-packages, node-version, ci, dependabot]
status: draft
generated: { by: human:neumaennl, at: 2026-11-15T17:40:00Z }
sources:
  - id: manifest
    resource: ../package.json
    title: Package manifest
  - id: tsconfig-build
    resource: ../tsconfig.build.json
    title: TypeScript configuration of the library
  - id: tsconfig-test
    resource: ../tsconfig.test.json
    title: TypeScript configuration of the tests
  - id: tsconfig-scripts
    resource: ../tsconfig.scripts.json
    title: TypeScript configuration of the scripts
  - id: tsconfig-target
    resource: ../tsconfig.target.json
    title: ECMAScript edition
  - id: npmignore
    resource: ../.npmignore
    title: Files left out of the package
  - id: npmrc
    resource: ../.npmrc
    title: npm configuration of the repository
  - id: node-version
    resource: ../scripts/node-version.ts
    title: Node.js version script
  - id: node-releases
    resource: ../scripts/lib/node-releases.ts
    title: Node.js release data
  - id: compiler-target
    resource: ../scripts/lib/compiler-target.ts
    title: ECMAScript edition per Node.js version
  - id: eslint
    resource: ../eslint.config.mjs
    title: ESLint configuration
  - id: jscpd
    resource: ../.jscpd.json
    title: jscpd configuration
  - id: ci
    resource: ../.github/workflows/ci.yml
    title: CI workflow
  - id: dependabot
    resource: ../.github/dependabot.yml
    title: Dependabot configuration
---

# Purpose

This document describes how the package is built, checked, packaged and published, how the supported Node.js version is kept consistent, and what CI and Dependabot do. How to set up a development environment is in `CONTRIBUTING.md`; the tests are described in [Testing](testing.md).

# npm scripts

| Script | What it does |
|---|---|
| `npm run build` | compiles `src/` to `dist/` with `tsconfig.build.json` |
| `npm run typecheck` | type-checks `scripts/` with `tsconfig.scripts.json` |
| `npm test` | runs `build` and `typecheck` (`pretest`), then Vitest |
| `npm run lint` | runs ESLint and jscpd on the whole repository, see [Lint](#lint) |
| `npm run lint:fix` | runs ESLint and fixes what it can fix |
| `npm run node:check` | checks the Node.js version, see [Node.js version](#nodejs-version) |
| `npm run node:update` | changes the Node.js version, see [Node.js version](#nodejs-version) |

`prepare` runs `build`, so npm builds the package on `npm install` in a checkout and before `npm pack` and `npm publish`.[^manifest]

# TypeScript configurations

| File | Covers | Purpose |
|---|---|---|
| `tsconfig.target.json` | — | the ECMAScript edition of the supported Node.js version as `target` and `lib`; the build and the scripts extend it |
| `tsconfig.build.json` | `src/` | the build: `NodeNext` modules, `strict`, `noUncheckedIndexedAccess`, unreachable code as an error, declarations, output in `dist/` |
| `tsconfig.test.json` | `src/`, `__tests__/` | type-checking the tests in an editor; extends the build configuration and emits nothing |
| `tsconfig.scripts.json` | `scripts/` | type-checking the scripts, which Node.js runs directly as TypeScript; `strict`, `noUncheckedIndexedAccess`, unreachable code as an error, and only erasable syntax is allowed |
| `tsconfig.json` | — | references the build, test and scripts configurations, for editors and `tsc --build` |

The build configuration enables `experimentalDecorators` and `emitDecoratorMetadata`, but the library itself declares no decorated classes, so these options do not affect the output.[^tsconfig-build] Which decorators an application uses depends on its own configuration; both kinds are supported ([ADR 001](architecture/001-reimplementation.md#principles)). No script or CI step uses `tsconfig.test.json` (see [Tests are not type-checked](known-issues.md#tests-are-not-type-checked)).[^tsconfig-test]

`tsconfig.target.json` contains only `target` and `lib`, both set to the ECMAScript edition of the supported Node.js version, for example `ES2024` for Node.js 24.[^tsconfig-target] The edition is the `target` of the [`@tsconfig/bases`](https://github.com/tsconfig/bases) configuration for that version. Its `ESNext.*` libraries are left out, because their content changes with every TypeScript release, and so are its other options, such as `module` and `strict`, because they change between Node.js versions and the project sets its own. The build and the scripts extend the file, the Vitest plugin compiles the tests with its target (see [Testing](testing.md#two-vitest-projects)), and the tests that compile generated classes use its target and libraries. The code therefore uses only syntax and library features that the oldest supported Node.js version has, and `dist/` needs no newer runtime than `engines.node` declares. `npm run node:update` writes the file and `npm run node:check` checks it (see [Node.js version](#nodejs-version)).

The scripts are TypeScript that Node.js runs without compiling, which it can from 22.18 on; `tsconfig.scripts.json` therefore allows only syntax that can be erased (`erasableSyntaxOnly`) and relative imports with `.ts` extensions.[^tsconfig-scripts]

# The package

The package `@neumaennl/xmlbind-ts` is an ES module only (`"type": "module"`):[^manifest]

- `exports` has one entry, `.`, with `dist/index.js` and its declarations `dist/index.d.ts`; `main` and `types` point to the same files. While version 3 is reimplemented, the entry point exports nothing, and the package has no runtime dependencies and no command; the parts add them ([ADR 001](architecture/001-reimplementation.md#how-the-branch-starts)).
- CommonJS code can load it with `import()`, or with `require()` on Node.js versions that support `require()` of ES modules, which all supported versions do.

What goes into the package is decided by `.npmignore`, a list of exclusions: everything that is not listed is packed.[^npmignore] Besides `dist/`, the package therefore also contains the documentation in `docs/`, `AGENTS.md`, `.github/`, `.gitattributes`, `tsconfig.build.json`, `tsconfig.target.json`, `tsconfig.test.json` and the TypeScript build information files, and any untracked files that happen to lie in the checkout (see [The package contents are defined by a list of exclusions](known-issues.md#the-package-contents-are-defined-by-a-list-of-exclusions)). `npm pack --dry-run` lists the files.

# Publishing

The package is published to GitHub Packages, not to the npm registry: `publishConfig.registry` is `https://npm.pkg.github.com`.[^manifest] The repository's `.npmrc` maps the scope `@neumaennl` to GitHub Packages and reads the token from the environment variable `NODE_AUTH_TOKEN`; everything else comes from the npm registry.[^npmrc]

No workflow publishes the package. A release is published with `npm publish` from a checkout, with a token that may write packages in `NODE_AUTH_TOKEN`; `prepare` builds `dist/` first. The version is raised in `package.json` in a commit of its own, and each release has a tag with its version, such as `2.3.0`.

Installing the package needs a token as well, even though the repository is public, because GitHub Packages does not allow anonymous downloads. A consumer maps the scope `@neumaennl` to `https://npm.pkg.github.com` in its own npm configuration and provides a token with the scope `read:packages`; `README.md` shows how.

# Node.js version

The package supports one Node.js major version and all newer ones, declared in `engines.node`. Four values must agree, and `npm run node:check` checks that they do:[^node-version]

| Value | Rule |
|---|---|
| `engines.node` | `>=` and the major version, for example `>=24`. All runtime dependencies must accept every version it includes: its first release, such as 24.0.0, and the first release of every newer line before its end of life. |
| `@types/node` | `^` and a version with the same major version, so that the types offer no API of a newer Node.js version. Dependabot ignores its major updates. |
| `.nvmrc` | the major version, for example `24`. Development and CI use the latest release of that major version. |
| `tsconfig.target.json` | `target` and the only entry of `lib` are the edition of the `@tsconfig/bases` configuration for the major version, for example `ES2024` from `node24.json`; the case does not matter.[^compiler-target] |

`engines.node` is a declaration, not a lock: Node.js itself ignores it, and npm and pnpm only warn about an unsupported version unless `engine-strict` is set. Besides the runtime dependencies, `node:check` checks the range in which Node.js can `require()` ES modules, because generated classes compiled as CommonJS load the package that way.[^node-releases]

`npm run node:check` fails if the values do not agree, if a runtime dependency excludes a version that `engines.node` includes, if there is no `@tsconfig/bases` configuration for the major version, or if the major version has reached its end of life. It warns in the 90 days before the end of life; with `--strict`, the warning fails as well. If `@tsconfig/bases` changes the edition for a major version, the weekly CI run fails until `npm run node:update` has taken it over. The scripts use only Node.js itself, so CI runs the check without installing the dependencies.

`npm run node:update` changes the major version. It lists the runtime dependencies and the Node.js versions they accept, and a table of the release lines with their status, whether all dependencies accept them, the matching `@types/node`, the ECMAScript edition, the latest release and the end of life. It asks for the major version, with the newest LTS version as the default, and refuses one without a `@tsconfig/bases` configuration. It writes `package.json`, `.nvmrc` and `tsconfig.target.json`, and offers to install the latest release of that version with nvm, nvm-windows or fnm and to run `npm install`, `npm run lint` and `npm test` with it. `npm run node:update -- <major>` skips the question. The supported version in `README.md` is then updated by hand, and everything is committed together.

The scripts read the release schedule from the Node.js release repository on GitHub, the releases from nodejs.org and the versions of `@types/node` from the npm registry.[^node-releases] They read the `@tsconfig/bases` configurations from its repository on GitHub, from which the packages `@tsconfig/node<major>` are published.[^compiler-target]

# Lint

`npm run lint` runs ESLint and the copy-paste detector jscpd in parallel, with concurrently:[^manifest]

- both tools always run to the end, so one run reports all problems;
- the run fails if one of them fails;
- `--group` prints the output of each tool as one block, labeled `[eslint]` and `[jscpd]`.

To run one tool alone, use `npx eslint .` or `npx jscpd`. They read the same configuration as `npm run lint`.

## ESLint

ESLint gives each kind of file the rules that fit it:[^eslint]

| Files | Rules |
|---|---|
| `.ts` | the recommended rules of ESLint, and the strict and stylistic rules of `typescript-eslint` with type information (see below) |
| `.ts` in `__tests__` folders | in addition, the recommended rules of the Vitest plugin |
| `.mjs`, such as `eslint.config.mjs` | the recommended rules of ESLint |

The project's own settings:

- the rules of `typescript-eslint` need type information, which ESLint takes from the projects that `tsconfig.json` references; `vitest.config.ts`, which none of them includes, is checked without a project;
- unused variables, imports and parameters are errors, except parameters and variables whose names start with `_`; ESLint checks them, not TypeScript, so that they are reported once;
- unreachable code is reported by TypeScript (`allowUnreachableCode: false`), not by ESLint: TypeScript knows types such as `never`, so `typescript-eslint` turns `no-unreachable` off;
- `@typescript-eslint/restrict-template-expressions` allows numbers in template literals, but no other types that are not strings, such as `undefined`;
- `@typescript-eslint/explicit-function-return-type` asks for the return type of every function;
- `@typescript-eslint/switch-exhaustiveness-check` reports a `switch` on a union or enum that misses cases;
- `@typescript-eslint/consistent-type-imports` asks for `import type` when only types are imported; it leaves files with decorators alone while `emitDecoratorMetadata` is on, because the metadata needs the values;
- `unknown` is not allowed in type assertions (`x as unknown`) and in the types of variables (`const x: unknown`), because both bypass type checks;
- in the tests, `@typescript-eslint/no-empty-function` allows empty arrow functions, such as empty mock implementations;
- `vitest/expect-expect` accepts the assertion helpers of the tests;
- `vitest/consistent-test-it` asks for `test()` instead of `it()`, also inside `describe()`, as the [development guidelines](development-guidelines.md#tests) say;
- `vitest/no-importing-vitest-globals` reports imports of `test`, `expect`, `vi` and the rest of Vitest's API, which the tests use as globals (`globals: true` in `vitest.config.ts`); types such as `Mock` are still imported;
- among the strict rules, `@typescript-eslint/no-floating-promises` reports promises that are neither awaited nor handled, because their errors would be lost; in the tests, a failing assertion in `withTmpDir()` would not fail its test;
- the local rule `style/max-ternary-lines`, defined in `eslint.config.mjs`, reports conditional expressions that span more than three lines, which the guidelines ask to write as `if`/`else` (see [Code quality](development-guidelines.md#code-quality));
- the size limits of the [development guidelines](development-guidelines.md#code-size): `max-lines` allows 500 lines per file and `max-lines-per-function` 120 lines per function; test files may have 1000 lines, and instead of the limit for functions, the local rule `tests/max-lines-per-test`, defined in `eslint.config.mjs`, allows 50 lines per test, because `max-lines-per-function` would also count the `describe` callbacks that hold the tests;
- `.js`, `.cjs`, `.mts` and `.cts` files are not allowed at all, because the package is an ES module and needs no other kinds of files;
- `dist/`, `coverage/`, `test-results/` and folders named `generated/` are ignored.

## Duplicated code

jscpd checks the TypeScript and JavaScript files of the whole repository. It skips what `.gitignore` excludes, such as `dist/`, `coverage/` and `node_modules/`. Its settings:[^jscpd]

- **Size.** A clone is a block of at least 50 tokens and 5 lines that appears more than once. Tokens are keywords, names, operators, punctuation and literals; whitespace and comments do not count. 50 tokens are about 5 to 7 lines of code. Below that, jscpd mostly finds repetition that is fine, such as the setup of tests.
- **Names.** Names are ignored, so a copy with renamed variables is found. Each name must stand for one name in the other block: `a = b + c` matches `x = y + z`, but not `x = x + x`.
- **Literals.** Strings and numbers are compared. Code that differs only in them is not a clone, such as the cases of a `switch` or tests with different data.
- **Failing.** Every clone fails the run. There is no threshold of duplicated lines, because a percentage changes as the code grows.
- **No files.** A run that finds no files fails, so that a broken configuration does not pass unnoticed.

The tests are checked with the same settings. Whether they need settings of their own is decided again with the first tests of version 3.

Code that has to stay duplicated is put between `// jscpd:ignore-start` and `// jscpd:ignore-end`, with a comment that gives the reason (see [Development guidelines](development-guidelines.md#code-quality)).

# CI

The workflow `CI` runs on pushes to `main` and to `reimplementation`, the branch of version 3 ([ADR 001](architecture/001-reimplementation.md)), on pull requests into `main`, and weekly on Mondays at 06:00 UTC.[^ci] It has two jobs:

| Job | Runs | Steps |
|---|---|---|
| Check Node versions | always | `npm run node:check`; on the weekly run with `--strict`, so that GitHub sends a notification before the end of life |
| Install, build and test | not on the weekly run | `npm ci`, `npm run lint` (ESLint and jscpd), `npm run build`, `npm test -- --coverage`, which fails below the coverage thresholds, and the test and coverage reports in the job summary and, on pull requests, as a comment (see [Testing](testing.md#ci)) |

Both jobs use the latest release of the major version in `.nvmrc` (`check-latest: true`), on Ubuntu only. A warning of `node:check` appears as an annotation of the run. GitHub pauses scheduled workflows of a public repository after 60 days without activity; the workflow then has to be enabled again in the Actions tab.

`npm test` builds again in `pretest`, although the step before has just built (see [CI builds twice](known-issues.md#ci-builds-twice)).

# Dependabot

Dependabot checks the npm dependencies and the GitHub Actions daily.[^dependabot] It groups the updates of ESLint, of Vite and of Vitest, each into one pull request, and ignores major updates of `@types/node`, which follow `engines.node` (see [Node.js version](#nodejs-version)). CI checks its pull requests like any other.

# Changelog and log

`CHANGELOG.md` records the functional changes of the package, under "Unreleased" until a version is released. Changes of the documentation only go into [the log](log.md) of this bundle, see the [development guidelines](development-guidelines.md#documentation).

[^manifest]: Package manifest

[^tsconfig-build]: TypeScript configuration of the library

[^tsconfig-test]: TypeScript configuration of the tests

[^tsconfig-scripts]: TypeScript configuration of the scripts

[^tsconfig-target]: ECMAScript edition

[^npmignore]: Files left out of the package

[^npmrc]: npm configuration of the repository

[^node-version]: Node.js version script

[^node-releases]: Node.js release data

[^compiler-target]: ECMAScript edition per Node.js version

[^eslint]: ESLint configuration

[^jscpd]: jscpd configuration

[^ci]: CI workflow

[^dependabot]: Dependabot configuration
