---
type: Guideline
title: Development guidelines
description: Rules for everyone who changes the library or the generator - code size, code quality and ESLint, TypeScript, the Node version, TSDoc, tests, documentation and the knowledge bundle, what to check before committing, and commits.
tags: [guidelines, conventions, code-quality, typescript, documentation, workflow]
status: stable
generated: { by: human:neumaennl, at: 2026-10-30T09:14:29Z }
verified: { by: human:neumaennl, at: 2026-10-30T09:19:49Z }
sources:
  - id: manifest
    resource: ../package.json
    title: Package manifest (scripts)
  - id: eslint
    resource: ../eslint.config.mjs
    title: ESLint configuration
  - id: tsconfig
    resource: ../tsconfig.build.json
    title: TypeScript configuration of the library
  - id: agents
    resource: ../AGENTS.md
    title: Instructions for AI coding agents
  - id: okf
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format specification
---

# Purpose

These rules apply to everyone who changes the library, the `xsd2ts` generator or the scripts, people and AI coding agents alike. Agents get them through `AGENTS.md`, which adds only what is specific to agents: their role, how they work with the maintainer, and a few rules for their own work.[^agents]

# Code size

- A TypeScript file has at most 500 lines. When it grows beyond that, move related code into a module of its own with a clear name.
- A function has at most 120 lines. Split longer functions into smaller helpers with one responsibility each.
- For now, test files are exempt from both limits.

ESLint should check the limits with the rules `max-lines` and `max-lines-per-function`, but does not do so yet.[^eslint]

# Code quality

- Avoid duplicated code. Move it into a shared function, class or module.
- `npm run lint` must report no errors, and as few warnings as possible. `npm run lint:fix` fixes what it can.[^manifest]
- Disable an ESLint rule only as a last resort, with an `eslint-disable-next-line` comment that gives the reason.
- Have the changes reviewed by Copilot code review and handle its comments. If you do not follow a comment, give the reason.

# TypeScript

- Follow the established best practices for TypeScript.
- The TypeScript configuration is `strict`.[^tsconfig]
- Define interfaces or types for data structures.
- Names: PascalCase for classes, interfaces, types and decorators; camelCase for functions, methods and variables; UPPER_CASE for module-level constants. Names say what something is or does.
- Length of names: clarity comes first, but keep them short. Aim for less than 15 characters; 25 to 30 is the upper limit. `createElement` is better than `createElementWithChildren`; `createElementNodeWithProcessingOfAnonymousTypes` is too long, `cen` too cryptic.
- Avoid `any` where possible; use a specific type or `unknown` instead. ESLint does not report `any`.[^eslint]

# Node version

One Node.js major version is used for `engines.node`, `@types/node` and `.nvmrc`. Change it only with `npm run node:update`, not by hand; `README.md` describes how (section "Node.js version for development").[^manifest]

# TSDoc

Every function has an up-to-date TSDoc comment: what it does, each parameter with `@param name - description`, the return value with `@returns` (functions without a return value have none), and the errors it throws with `@throws`. Complex functions also get an `@example`.

```typescript
/**
 * Converts the text of an XML attribute or element to the type of a field.
 *
 * @param value - The text from the XML document
 * @param type - The constructor of the field's type, such as `Number`
 * @returns The converted value
 * @throws {Error} If the value cannot be converted
 */
```

# Tests

- New and changed code is tested.
- Test cases use `test()`, not `it()`.
- A test file tests one feature. Tests for the same feature are not scattered over several test files.
- Two tests do not test exactly the same thing.
- Bigger XML or XSD snippets go into `__tests__/test-resources` and are reused where possible.

# Documentation

The documentation of the library and the generator is the knowledge bundle in `docs/`, in the Open Knowledge Format; its index is `docs/index.md`.[^okf]

- **Keep it current.** When a change affects what a document describes, update the document in the same change. Then set its `generated` to the person responsible for the content (`by: human:<GitHub user>`, also when an agent wrote the text) and the current time (UTC), set `status: draft` and remove `verified`, and add an entry to the log `docs/log.md`, newest date first. When the maintainer has approved the document, set `status: stable` and add `verified` with `by: human:<GitHub user>` and the time.
- **Known issues.** Record problems you find outside the current task in `docs/known-issues.md`, sorted by severity and effort, and remove them when they are fixed. A change to the known issues is a change like any other.
- **New documents** get front matter (`type`, `title`, a one-sentence `description`, `tags`, `status`, `generated`, `sources`), an entry in the index with the same description, and a log entry.
- **Sources.** Each source has an `id`, a relative `resource` and a `title`. Important statements get a footnote `[^id]` whose text is the title of the source. Separate the footnote definitions with blank lines.
- **Format.** Files use LF line endings, which `.gitattributes` (`* text=auto`) makes Git store for every text file. Links are relative; code and file paths are formatted as code, without line numbers. A document describes the current state and decided future work, not its own history; the history goes into the log. No volatile numbers such as test counts or durations.
- **Diagrams.** Mermaid diagrams use one arrow with a combined label for both directions, so that labels do not overlap. Check that a diagram renders with `npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.png`.
- **README, contributing and changelog.** `README.md` is written for users and describes the state of the branch it is on; information for contributors goes into `CONTRIBUTING.md`. `CHANGELOG.md` records the functional changes of the package under "Unreleased"; changes of the documentation only go into the log of the bundle.

# Before committing

1. `npm run lint` passes.
2. `npm test` passes; it first builds the library and type-checks the scripts (`pretest`).[^manifest]
3. The changes follow these guidelines.
4. The documentation is updated, and `CHANGELOG.md` for functional changes.
5. Copilot code review has checked the changed files.

# Commits

- Each commit has one purpose and a clear message.
- A change that is reviewed in steps can be committed after each step. Before it is merged, the commits are combined so that each remaining commit has one purpose: the message of the first commit is reworded to describe the whole change, and the later commits are marked as `fixup` with `git rebase -i`. Do not use `squash`, because it combines the messages.
- Rewriting commits that were already pushed needs a force push. Agree on it with the others who work on the branch.

[^manifest]: Package manifest (scripts)

[^eslint]: ESLint configuration

[^tsconfig]: TypeScript configuration of the library

[^agents]: Instructions for AI coding agents

[^okf]: Open Knowledge Format specification
