---
okf_version: "0.2"
---

# Overview

* [Architecture](architecture.md) - What xmlbind-ts is responsible for and what belongs to the application, while version 3 is reimplemented.

# Architecture decisions

* [ADR 001: Reimplementation of xmlbind-ts as version 3](architecture/001-reimplementation.md) - The decision to replace 2.x by a reimplementation as version 3.0.0 instead of fixing its known issues one by one, with the principles that version 3 follows, its parts and their order, how the branch starts, and the rejected alternatives.

# Working on the library

* [Development guidelines](development-guidelines.md) - Rules for everyone who changes the library or the generator - code size, code quality and ESLint, TypeScript, the Node version, TSDoc, tests, documentation and the knowledge bundle, what to check before committing, and commits.
* [Testing](testing.md) - How xmlbind-ts is tested - running the tests, the two Vitest projects for legacy and Stage 3 decorators, the test utilities and resources, the kinds of tests, coverage, CI, and what the tests do not cover.
* [Build and release](build-and-release.md) - How the package is built, linted, packaged and published - the npm scripts, the TypeScript configurations, the module format and the package contents, GitHub Packages, the Node.js version and its scripts, CI, Dependabot, and the changelog.

# Maintenance

* [Known issues](known-issues.md) - Problems found in the library, the generator and the project setup that are not fixed yet, with links to GitHub issues where they exist.

# Agent instructions

The folder `agent-instructions/` holds instructions for AI coding agents that [`AGENTS.md`](../AGENTS.md) refers to. They are plain files without front matter: they tell agents how to work, rather than describing the code, and are not part of the knowledge bundle.
