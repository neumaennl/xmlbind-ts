---
type: Build
title: Build and release
description: How the package is built, linted, packaged and published - the npm scripts, the TypeScript configurations, the module format and the package contents, GitHub Packages, the Node.js version and its scripts, CI, Dependabot, and the changelog.
tags: [build, npm, packaging, github-packages, node-version, ci, dependabot]
status: draft
generated: { by: human:neumaennl, at: 2026-11-27T11:50:04Z }
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
  - id: fallow
    resource: ../.fallowrc.jsonc
    title: fallow configuration
  - id: check-anonymous-types
    resource: ../scripts/check-anonymous-types.ts
    title: Check of anonymous types
  - id: prettier
    resource: ../.prettierrc.json
    title: Prettier configuration
  - id: vscode
    resource: ../.vscode/settings.json
    title: VS Code settings of the workspace
  - id: ci
    resource: ../.github/workflows/ci.yml
    title: CI workflow
  - id: dependabot
    resource: ../.github/dependabot.yml
    title: Dependabot configuration
  - id: fallow-stale-dupes
    resource: https://github.com/fallow-rs/fallow/issues/5406
    title: "fallow: report stale code-duplication suppressions"
---

# Purpose

This document describes how the package is built, checked, packaged and published, how the supported Node.js version is kept consistent, and what CI and Dependabot do. How to set up a development environment is in `CONTRIBUTING.md`; the tests are described in [Testing](testing.md).

# npm scripts

| Script                | What it does                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run build`       | compiles `src/` to `dist/` with `tsconfig.build.json`                                                |
| `npm run typecheck`   | type-checks `scripts/` with `tsconfig.scripts.json`                                                  |
| `npm test`            | runs `build` and `typecheck` (`pretest`), then Vitest                                                |
| `npm run lint`        | runs ESLint, fallow, the check of anonymous types and the check of the formatting, see [Lint](#lint) |
| `npm run lint:fix`    | runs ESLint and fixes what it can fix                                                                |
| `npm run format`      | formats all files with Prettier, see [Formatting](#formatting)                                       |
| `npm run node:check`  | checks the Node.js version, see [Node.js version](#nodejs-version)                                   |
| `npm run node:update` | changes the Node.js version, see [Node.js version](#nodejs-version)                                  |

`prepare` runs `build`, so npm builds the package on `npm install` in a checkout and before `npm pack` and `npm publish`.[^manifest]

# TypeScript configurations

| File                    | Covers               | Purpose                                                                                                                                                                       |
| ----------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.target.json`  | —                    | the ECMAScript edition of the supported Node.js version as `target` and `lib`; the build and the scripts extend it                                                            |
| `tsconfig.build.json`   | `src/`               | the build: `NodeNext` modules, `strict`, `noUncheckedIndexedAccess`, unreachable code as an error, declarations, output in `dist/`                                            |
| `tsconfig.test.json`    | `src/`, `__tests__/` | type-checking the tests in an editor; extends the build configuration and emits nothing                                                                                       |
| `tsconfig.scripts.json` | `scripts/`           | type-checking the scripts, which Node.js runs directly as TypeScript; `strict`, `noUncheckedIndexedAccess`, unreachable code as an error, and only erasable syntax is allowed |
| `tsconfig.json`         | —                    | references the build, test and scripts configurations, for editors and `tsc --build`                                                                                          |

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

| Value                  | Rule                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engines.node`         | `>=` and the major version, for example `>=24`. All runtime dependencies must accept every version it includes: its first release, such as 24.0.0, and the first release of every newer line before its end of life. |
| `@types/node`          | `^` and a version with the same major version, so that the types offer no API of a newer Node.js version. Dependabot ignores its major updates.                                                                      |
| `.nvmrc`               | the major version, for example `24`. Development and CI use the latest release of that major version.                                                                                                                |
| `tsconfig.target.json` | `target` and the only entry of `lib` are the edition of the `@tsconfig/bases` configuration for the major version, for example `ES2024` from `node24.json`; the case does not matter.[^compiler-target]              |

`engines.node` is a declaration, not a lock: Node.js itself ignores it, and npm and pnpm only warn about an unsupported version unless `engine-strict` is set. Besides the runtime dependencies, `node:check` checks the range in which Node.js can `require()` ES modules, because generated classes compiled as CommonJS load the package that way.[^node-releases]

`npm run node:check` fails if the values do not agree, if a runtime dependency excludes a version that `engines.node` includes, if there is no `@tsconfig/bases` configuration for the major version, or if the major version has reached its end of life. It warns in the 90 days before the end of life; with `--strict`, the warning fails as well. If `@tsconfig/bases` changes the edition for a major version, the weekly CI run fails until `npm run node:update` has taken it over. The scripts use only Node.js itself, so CI runs the check without installing the dependencies.

`npm run node:update` changes the major version. It lists the runtime dependencies and the Node.js versions they accept, and a table of the release lines with their status, whether all dependencies accept them, the matching `@types/node`, the ECMAScript edition, the latest release and the end of life. It asks for the major version, with the newest LTS version as the default, and refuses one without a `@tsconfig/bases` configuration. It writes `package.json`, `.nvmrc` and `tsconfig.target.json`, and offers to install the latest release of that version with nvm, nvm-windows or fnm and to run `npm install`, `npm run lint` and `npm test` with it. `npm run node:update -- <major>` skips the question. The supported version in `README.md` is then updated by hand, and everything is committed together.

The scripts read the release schedule from the Node.js release repository on GitHub, the releases from nodejs.org and the versions of `@types/node` from the npm registry.[^node-releases] They read the `@tsconfig/bases` configurations from its repository on GitHub, from which the packages `@tsconfig/node<major>` are published.[^compiler-target]

# Lint

`npm run lint` runs these checks in parallel, with concurrently:[^manifest]

- ESLint;
- fallow, once for duplicated code (see [Duplicated code](#duplicated-code)), and for unused code once for the whole project and once in production mode (see [Unused code](#unused-code));
- the check of anonymous types (see [Anonymous types](#anonymous-types));
- Prettier, which checks the formatting (see [Formatting](#formatting)).

How concurrently runs them:

- all checks always run to the end, so one run reports all problems;
- the run fails if one of them fails;
- `--group` prints the output of each check as one block, labeled `[eslint]`, `[fallow-dupes]`, `[fallow]`, `[fallow-production]`, `[anonymous-types]` and `[prettier]`.

To run one check alone, use `npx eslint .`, `npx fallow dupes --no-cache --fail-on-issues`, `npx fallow dead-code --no-cache --fail-on-issues`, `npx fallow dead-code --production --no-cache --fail-on-issues`, `node scripts/check-anonymous-types.ts` or `npx prettier --check .`. They read the same configuration as `npm run lint`.

## ESLint

ESLint gives each kind of file the rules that fit it:[^eslint]

| Files                               | Rules                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.ts`                               | the recommended rules of ESLint, and the strict and stylistic rules of `typescript-eslint` with type information (see below) |
| `.ts` in `__tests__` folders        | in addition, the recommended rules of the Vitest plugin                                                                      |
| `.mjs`, such as `eslint.config.mjs` | the recommended rules of ESLint                                                                                              |

The project's own settings:

- the rules of `typescript-eslint` need type information, which ESLint takes from the projects that `tsconfig.json` references; `vitest.config.ts`, which none of them includes, is checked without a project;
- unused variables, imports and parameters are errors, except parameters and variables whose names start with `_`; ESLint checks them, not TypeScript, so that they are reported once;
- unused private class members are errors; `@typescript-eslint/no-unused-private-class-members` replaces the rule of ESLint, because it also finds members declared with `private`, not only `#private` ones;
- unreachable code is reported by TypeScript (`allowUnreachableCode: false`), not by ESLint: TypeScript knows types such as `never`, so `typescript-eslint` turns `no-unreachable` off;
- `@typescript-eslint/restrict-template-expressions` allows numbers in template literals, but no other types that are not strings, such as `undefined`;
- `@typescript-eslint/explicit-function-return-type` asks for the return type of every function;
- `@typescript-eslint/switch-exhaustiveness-check` reports a `switch` on a union or enum that misses cases; a `default` branch counts as handling the other cases (`considerDefaultExhaustiveForUnions`);
- `@typescript-eslint/consistent-type-imports` asks for `import type` when only types are imported; it leaves files with decorators alone while `emitDecoratorMetadata` is on, because the metadata needs the values;
- `unknown` is not allowed in type assertions (`x as unknown`) and in the types of variables (`const x: unknown`), because both bypass type checks;
- some of the strict and stylistic rules change code in ways that are not obvious:
  - `no-confusing-void-expression`: an arrow function whose body is a call that returns nothing gets braces, `() => { save(); }` instead of `() => save()`. Without braces, the arrow function returns the value of its body, so the short form looks as if it returned something; with braces, it is clear that nothing is returned;
  - `prefer-regexp-exec`: a regular expression is applied with `re.exec(text)`, not `text.match(re)`. What `match` returns depends on the flag `g`: without it, the first match with its groups, like `exec`; with it, all matches without groups. `exec` always returns the same kind of result, so adding `g` later cannot change it silently;
  - `array-type` with `array-simple`: `T[]` for simple element types, `Array<…>` and `ReadonlyArray<…>` for complex ones, which would need parentheses otherwise (`Array<keyof T>` instead of `(keyof T)[]`);
  - `consistent-type-definitions`: object types are declared as `interface`; `type` stays for unions, mapped and conditional types. Both describe object shapes alike, but interfaces can be extended with `extends`, and two interfaces of the same name merge instead of failing;
- in the tests, `@typescript-eslint/no-empty-function` allows empty arrow functions, such as empty mock implementations, and test files may use non-null assertions (`items[0]!`), as the [development guidelines](development-guidelines.md#typescript) say; the helpers of the tests check their values like other code;
- `vitest/expect-expect` counts calls of functions whose names start with `expect` as assertions, so tests that only use assertion helpers are not reported;
- `vitest/valid-expect` allows a message as second argument of `expect()`, which Vitest supports;
- `vitest/unbound-method` replaces `@typescript-eslint/unbound-method` in the tests, because it accepts mock functions, which do not depend on `this`;
- `vitest/consistent-test-it` asks for `test()` instead of `it()`, also inside `describe()`, as the [development guidelines](development-guidelines.md#tests) say;
- `vitest/valid-title` asks for test titles that start with "should", as the [development guidelines](development-guidelines.md#tests) say; the titles of `describe()` are free;
- `vitest/no-importing-vitest-globals` reports imports of `test`, `expect`, `vi` and the rest of Vitest's API, which the tests use as globals (`globals: true` in `vitest.config.ts`); types such as `Mock` are still imported;
- among the strict rules, `@typescript-eslint/no-floating-promises` reports promises that are neither awaited nor handled, because their errors would be lost; in the tests, a failing assertion in `withTmpDir()` would not fail its test;
- the local rule `style/max-ternary-lines`, defined in `eslint.config.mjs`, reports conditional expressions that span more than three lines, which the guidelines ask to write as `if`/`else` (see [Code quality](development-guidelines.md#code-quality));
- TSDoc, as the [development guidelines](development-guidelines.md#tsdoc) ask: `tsdoc/syntax` of `eslint-plugin-tsdoc` checks the syntax of the comments; the rules of `eslint-plugin-jsdoc` check that function declarations, methods and classes have a comment, and that it describes every parameter, the return value and the errors thrown; `tsdoc/syntax` also reports a missing hyphen between the name and the description of a parameter. Arrow functions and function expressions, mostly small local helpers and callbacks, need no comment. Destructured parameters are not checked, because TSDoc describes their fields at their type;
- the size limits of the [development guidelines](development-guidelines.md#code-size): `max-lines` allows 500 lines per file and `max-lines-per-function` 120 lines per function; test files may have 1000 lines, and instead of the limit for functions, the local rule `tests/max-lines-per-test`, defined in `eslint.config.mjs`, allows 50 lines per test, because `max-lines-per-function` would also count the `describe` callbacks that hold the tests;
- `.js`, `.cjs`, `.mts` and `.cts` files are not allowed at all, because the package is an ES module and needs no other kinds of files;
- `dist/`, `coverage/`, `test-results/` and folders named `generated/` are ignored, and so are the local drafts in `.drafts/`, because ESLint does not read `.git/info/exclude`.

## Duplicated code

`fallow dupes` checks the TypeScript and JavaScript files of the whole repository, the tests included. It skips what `.gitignore` excludes, such as `dist/`, `coverage/` and `node_modules/`, and the local drafts in `.drafts/`. Its settings are in the `duplicates` section of `.fallowrc.jsonc`:[^fallow]

- **Size.** A clone is a block of at least 50 tokens and 5 lines that appears more than once. Tokens are keywords, names, operators, punctuation and literals; whitespace and comments do not count. 50 tokens are about 5 to 7 lines of code. Below that, the check mostly finds repetition that is fine, such as the setup of tests.
- **Names.** Names are ignored, so a copy with renamed variables is found (`ignoreIdentifiers`). Each name must stand for one name in the other block (`consistentIdentifiers`): `a = b + c` matches `x = y + z`, but not `x = x + x`.
- **Literals.** Strings, numbers and the text of template literals are compared. Code that differs only in them is not a clone, such as the cases of a `switch` or tests with different data.
- **Imports.** Imports and re-exports are skipped (`ignoreImports`). [Prettier](#formatting) puts each name of a long import on its own line, and since names are ignored, any two long imports or re-exports would match.
- **Tests.** `ignoreDefaults` is off. Otherwise fallow would leave out test files and folders such as `__tests__/`, and the output folders of some frameworks, which this repository does not have.
- **Failing.** `--fail-on-issues` makes every clone fail the run; without it, `fallow dupes` only reports them. There is no threshold of duplicated lines, because a percentage changes as the code grows. `--no-cache` keeps fallow from writing a cache into the checkout.
- **No files.** A run that finds no files does not fail. fallow finds its files the same way for duplicated and for [unused code](#unused-code): from the root of the project, following `.gitignore`. So there is no list of paths or formats that could be wrong. Only a far too broad ignore pattern could leave no files, and that would be a visible change to `.fallowrc.jsonc`.

The tests are checked with the same settings. Whether they need settings of their own is decided again with the first tests of version 3.

Code that has to stay duplicated is put between two comments, each on its own line, with the reason after `--` (see [Development guidelines](development-guidelines.md#code-quality)):

```typescript
// fallow-ignore-start code-duplication -- <reason>
// fallow-ignore-end code-duplication
```

`fallow dead-code` fails if the reason is missing (`require-suppression-reason`, see [Unused code](#unused-code)). Unlike the other kinds of ignore comments, fallow never reports a `code-duplication` comment as stale. This holds for the range, `fallow-ignore-next-line` and `fallow-ignore-file`. So when the code is no longer duplicated, nothing fails. Check the comments when you change the code they cover.[^fallow-stale-dupes]

## Unused code

ESLint and TypeScript only find unused code within one file (see [ESLint](#eslint)). [fallow](https://fallow.tools) checks the whole project.[^fallow] It finds:

- files that nothing imports;
- exports and types that no other module imports, also when the same file uses them;
- public, protected and static class members and enum members that nothing uses;
- dependencies in `package.json` that no code uses, and packages that code uses but `package.json` does not list.

fallow finds the entry points itself, in `package.json` and in the configurations of the tools, such as Vitest. It reads the code without type information.

`npm run lint` runs it twice:

- **`fallow dead-code`** checks the whole project, including the tests.
- **`fallow dead-code --production`** leaves out the tests and the devDependencies. It finds code that only tests use, such as an export that only a test imports, or a method that only tests call.

Both runs use `--fail-on-issues`, so every finding fails the run, also the kinds that fallow only reports as warnings by default, such as an unused devDependency. There is no baseline. `--no-cache` keeps fallow from writing a cache into the checkout.

`.fallowrc.jsonc` adds three rules:[^fallow]

- `require-suppression-reason`: an ignore comment must give its reason after `--`, as in `// fallow-ignore-next-line unused-export -- <reason>`.
- `stale-suppressions` as an error: an ignore comment that no longer suppresses anything fails the run, so it is removed when it is no longer needed.
- `unused-protected-class-members` as an error: a protected member that neither its class nor a subclass uses is a finding. fallow does not report it by default.

The test helpers in `__tests__/test-utils/` are not used yet. The tests of version 3 will use them, so they have the comment `// fallow-ignore-file unused-file` with this reason. Once a test imports a helper, the comment becomes stale and has to be removed.

Its limits:

- Without type information, fallow does not see that a member is used when it is called by a computed name, such as `obj[name]()`. Such a member needs an ignore comment with the reason.
- fallow does not check private members. ESLint does.
- Members with decorators are not checked, because a decorator can use them.
- Protected members are not checked in the classes of the public API, because a user of the package can subclass them. fallow also counts every class in an entry point of `package.json` as public API, whether it is exported or not.
- Protected members that are declared as constructor parameters, as in `constructor(protected readonly x: X)`, are not checked. A protected member that is used by a string key, as in `this["name"]()`, needs an ignore comment with the reason.
- fallow finds unused files, exports and members, not unused branches within a function, such as the cases of a `switch` that no caller reaches. The coverage report shows them (see [Testing](testing.md#coverage)), so compare it before and after a change that removes code.

## Anonymous types

`scripts/check-anonymous-types.ts` checks the rule on named types of the [development guidelines](development-guidelines.md#typescript).[^check-anonymous-types] It parses the production code with the TypeScript API: the TypeScript files in `src/` and `scripts/`, without `__tests__/` folders and test files. It fails if the same anonymous type occurs more than once, and lists the places of each one.

- **Counted:** object types, unions, tuples and function types written where a type is expected. The definition of a named type (`type X = …`) is not an anonymous type.
- **Not counted:** types that a name would not explain. These are `X | undefined` and `X | null`, unions of primitive types such as `number | string`, functions without parameters that return such a type, such as `() => void`, and the empty object type.
- **Same type:** whitespace, comments and the order of the members of a union do not matter. The names of parameters do, because `(next: string) => void` and `(message: string) => void` stand for different things.

ESLint has no rule for this, because a rule sees one file at a time.

## Formatting

Prettier formats TypeScript, `.mjs`, JSON, JSONC, YAML and Markdown.[^prettier]

- `npm run format` formats all files.
- `npm run lint` checks them with `prettier --check .`, so CI does too.
- VS Code formats these files on save with the Prettier extension, which `.vscode/extensions.json` recommends.[^vscode] The settings name the languages one by one, so that VS Code does not format other files, such as XSD, with another formatter.

The settings in `.prettierrc.json`:[^prettier]

- Lines have at most 120 characters.
- Trailing commas are written in arrays, objects, imports and exports, and type parameters (`"trailingComma": "es5"`). They are not written after the parameters of a function, because a comma there looks strange. Prettier cannot tell definitions from calls, so the arguments of a call get none either.
- Everything else is Prettier's default: double quotes, semicolons, two spaces and LF line endings.

Prettier skips what `.gitignore` excludes. `.prettierignore` adds two more:

- `package-lock.json`, which npm writes;
- `.drafts/`, for local drafts. It is excluded in `.git/info/exclude`, which Prettier does not read.

The version of Prettier is pinned, without `^`, because a patch release can format differently. When Dependabot updates it and CI reports unformatted files, run `npm run format` on its branch.

No ESLint rule clashes with Prettier. This was checked with the command-line check of `eslint-config-prettier`, `npx eslint-config-prettier <file>`, for a TypeScript file and for `eslint.config.mjs`; run it again when rules are added. It only names `no-unexpected-multiline`, which it cannot check automatically:

- The rule reports statements that a missing semicolon joins with the next line. It stays on.
- In rare cases, Prettier breaks a chain of calls before an index access such as `[i]`, and the rule reports that. Then split the expression into two statements.

The size rules count lines, including the line breaks that Prettier adds (see [ESLint](#eslint)). Code that the formatting pushes past a limit is split like any other code that is too long.

`.git-blame-ignore-revs` lists the commits that only reformat the code, such as the one that formatted the whole repository with Prettier:

- GitHub skips them in its blame view.
- Locally, `git blame` skips them after `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
- The file names the commits by their hashes, so these commits must not be rewritten: a branch with them is merged without squashing or rebasing.

# CI

The workflow `CI` runs on pushes to `main` and to `reimplementation`, the branch of version 3 ([ADR 001](architecture/001-reimplementation.md)), on pull requests into `main` and into `reimplementation`, and weekly on Mondays at 06:00 UTC.[^ci] It has two jobs:

| Job                     | Runs                  | Steps                                                                                                                                                                                                                                                                                               |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Check Node versions     | always                | `npm run node:check`; on the weekly run with `--strict`, so that GitHub sends a notification before the end of life                                                                                                                                                                                 |
| Install, build and test | not on the weekly run | `npm ci`, `npm run lint` (ESLint, fallow, the check of anonymous types and Prettier), `npm run build`, `npm test -- --coverage`, which fails below the coverage thresholds, and the test and coverage reports in the job summary and, on pull requests, as a comment (see [Testing](testing.md#ci)) |

Both jobs use the latest release of the major version in `.nvmrc` (`check-latest: true`), on Ubuntu only. A warning of `node:check` appears as an annotation of the run. GitHub pauses scheduled workflows of a public repository after 60 days without activity; the workflow then has to be enabled again in the Actions tab.

`npm test` builds again in `pretest`, although the step before has just built (see [CI builds twice](known-issues.md#ci-builds-twice)).

# Dependabot

Dependabot checks the npm dependencies and the GitHub Actions daily.[^dependabot] It groups the updates of ESLint, of Vite and of Vitest, each into one pull request, and ignores major updates of `@types/node`, which follow `engines.node` (see [Node.js version](#nodejs-version)). Its version updates go to `reimplementation`, where version 3 is developed; security updates always go to `main`. CI checks its pull requests like any other. An update of Prettier can change the formatting (see [Formatting](#formatting)).

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

[^fallow]: fallow configuration

[^check-anonymous-types]: Check of anonymous types

[^prettier]: Prettier configuration

[^vscode]: VS Code settings of the workspace

[^ci]: CI workflow

[^dependabot]: Dependabot configuration

[^fallow-stale-dupes]: fallow: report stale code-duplication suppressions
