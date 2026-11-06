# Contributing

Contributions are welcome. This file describes how to set up the project, which checks a change has to pass and where to find the rules and the documentation.

## Setup

1. Clone the repository.
2. Use the Node.js major version in `.nvmrc`, for example with `nvm install`, which installs its latest release and switches to it. nvm-windows does not read `.nvmrc`; there, run `nvm install <version>` and `nvm use <version>` with the version from the file. CI uses the latest release of that major version as well.
3. Run `npm install`. It also builds the library (`prepare`).

No token is needed: all dependencies come from the npm registry.

## Everyday commands

| Command | What it does |
|---|---|
| `npm test` | builds the library, type-checks the scripts and runs all tests |
| `npx vitest run <file>` | runs one test file |
| `npm run lint` | runs ESLint; `npm run lint:fix` fixes what it can |
| `npm run build` | compiles `src/` to `dist/` |

[Build and release](docs/build-and-release.md#npm-scripts) lists all scripts, and [Testing](docs/testing.md) describes the tests, including the two Vitest projects that run every test with legacy and with Stage 3 decorators.

## Node.js version

One Node.js major version is used everywhere: in `engines.node`, `@types/node` and `.nvmrc`. `npm run node:check` checks that they agree; change the version only with `npm run node:update`, not by hand. [Build and release](docs/build-and-release.md#nodejs-version) describes both scripts.

## Rules

The [development guidelines](docs/development-guidelines.md) apply to every change: code size, code quality, TypeScript, TSDoc, tests, documentation and commits. AI coding agents also follow [AGENTS.md](AGENTS.md).

## Pull requests

Before you open a pull request, run the checks in [Before committing](docs/development-guidelines.md#before-committing): `npm run lint` and `npm test` pass, the changes follow the guidelines, and the documentation is updated.

A pull request into `main` is checked by:

- **CI**, which checks the Node.js version and then installs, lints, builds and runs the tests with coverage. The test results appear as the check "Vitest", the coverage totals in the job summary ([Build and release](docs/build-and-release.md#ci)).
- **Copilot code review**. Handle its comments, and give the reason when you don't follow one.

Commits follow the rules in [Commits](docs/development-guidelines.md#commits).

## Documentation

The documentation is in [`docs/`](docs/index.md). When a change affects what a document describes, update the document in the same pull request and add an entry to [the log](docs/log.md), as described in [Documentation](docs/development-guidelines.md#documentation). Problems you find but do not fix go into [Known issues](docs/known-issues.md).

`README.md` is written for users of the package. `CHANGELOG.md` records the functional changes under "Unreleased"; changes of the documentation only go into the log.
