---
type: Guideline
title: Development guidelines
description: Rules for everyone who changes the library or the generator - code size, code quality and ESLint, TypeScript, the Node version, TSDoc, tests, documentation and the knowledge bundle, what to check before committing, and commits.
tags: [guidelines, conventions, code-quality, typescript, documentation, workflow]
status: draft
generated: { by: human:neumaennl, at: 2026-11-16T19:25:47Z }
sources:
  - id: manifest
    resource: ../package.json
    title: Package manifest (scripts)
  - id: eslint
    resource: ../eslint.config.mjs
    title: ESLint configuration
  - id: jscpd
    resource: ../.jscpd.json
    title: jscpd configuration
  - id: fallow
    resource: ../.fallowrc.jsonc
    title: fallow configuration
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

Topics that have their own document are only linked here: the structure of the code in [Architecture](architecture.md), tests in [Testing](testing.md), and building, ESLint, the check for duplicated code and CI in [Build and release](build-and-release.md).

# Code size

- A TypeScript file has at most 500 lines. When it grows beyond that, move related code into a module of its own with a clear name.
- A function has at most 120 lines. Split longer functions into smaller helpers with one responsibility each.
- A test file has at most 1000 lines, and a single test at most 50. The limit for functions does not apply to test files, because their `describe` callbacks hold many tests. Helpers of the tests have the limits of other code.

Blank lines and comments count as well. ESLint checks the limits with the rules `max-lines` and `max-lines-per-function`, and the single tests with the local rule `tests/max-lines-per-test` (see [Build and release](build-and-release.md#eslint)).[^eslint]

# Code quality

- Avoid duplicated code. Move it into a shared function, class or module. `npm run lint` reports duplicated code with jscpd, also when names were changed (see [Build and release](build-and-release.md#duplicated-code)).[^jscpd]
- Remove code that nothing uses. `npm run lint` reports unused files, exports, class members and dependencies with fallow, also code that only tests use (see [Build and release](build-and-release.md#unused-code)).[^fallow]
- Export only what other modules use. Tests use a module through its exports; do not export something only so that a test can call it.
- A conditional expression (`a ? b : c`) spans at most three lines. Write a longer one, for example one with array or object literals in its branches or a nested one, as `if`/`else`. The local ESLint rule `style/max-ternary-lines` checks this.[^eslint]
- `npm run lint` must report no errors, and as few warnings as possible. `npm run lint:fix` fixes what ESLint can.[^manifest]
- Disable an ESLint rule only as a last resort, with an `eslint-disable-next-line` comment that gives the reason.
- Exclude duplicated code from jscpd only as a last resort. Put `// jscpd:ignore-start` and `// jscpd:ignore-end` around it, with a comment that gives the reason.
- Suppress a finding of fallow only as a last resort, with a `fallow-ignore-next-line` or `fallow-ignore-file` comment that gives the reason after `--`. fallow checks that the reason is there.[^fallow]
- Have the changes reviewed by Copilot code review and handle its comments. If you do not follow a comment, give the reason.

# TypeScript

- Follow the established best practices for TypeScript.
- The TypeScript configuration is `strict` and sets `noUncheckedIndexedAccess`, so that indexed access, such as `array[i]`, includes `undefined`. Check the value, or avoid the index with `for…of`, `find()` or `at()`. In tests, a non-null assertion (`items[0]!`) is fine, because a wrong assumption makes the test fail.[^tsconfig]
- Define interfaces or types for data structures.
- Define a type in the module that owns the data it describes. Put types that several modules share in a `types.ts` of their folder; `src/types.ts` holds the metadata types.
- Names: PascalCase for classes, interfaces, types and decorators; camelCase for functions, methods and variables; UPPER_CASE for module-level constants. Names say what something is or does.
- Length of names: clarity comes first, but keep them short. Aim for less than 15 characters; 25 to 30 is the upper limit. `createElement` is better than `createElementWithChildren`; `createElementNodeWithProcessingOfAnonymousTypes` is too long, `cen` too cryptic.
- Do not use `any`; use a specific type or `unknown` instead. ESLint reports `any`, and `unknown` in type assertions and in the types of variables.[^eslint]

# Node version

One Node.js major version is used for `engines.node`, `@types/node` and `.nvmrc`, and decides the compiler target in `tsconfig.target.json`. Change it only with `npm run node:update`, not by hand; [Build and release](build-and-release.md#nodejs-version) describes how.[^manifest]

# TSDoc

Every function, method and class has an up-to-date TSDoc comment: what it does, each parameter with `@param name - description`, the return value with `@returns` (functions without a return value have none), and the errors it throws with `@throws An {@link Error} if …`. Complex functions also get an `@example`.

```typescript
/**
 * Converts the text of an XML attribute or element to the type of a field.
 *
 * @param value - The text from the XML document
 * @param type - The constructor of the field's type, such as `Number`
 * @returns The converted value
 * @throws An {@link Error} if the value cannot be converted
 */
```

- `@throws` does not start with `{`: TypeScript, and so the hover of editors, reads a `{` right after `@throws` as the type of the error, and breaks `{@link Error}` there into two tags.
- TSDoc has no dotted parameter names such as `@param options.name`. Describe the fields of a destructured parameter at its type, with a comment per field.
- Code in comments is written as code: identifiers, expressions, XML, QNames such as `xs:string`, and file paths. This matters even more for package names that start with `@`, such as `@types/node`, and for text with `{`, `}` or `>`, because TSDoc would read them as tags or HTML.
- ESLint checks the syntax with `eslint-plugin-tsdoc`, and with `eslint-plugin-jsdoc` that the comments and their tags exist (see [Build and release](build-and-release.md#eslint)).[^eslint]

# Tests

- New and changed code is tested.
- Test cases use `test()`, not `it()`. ESLint checks this with the rule `vitest/consistent-test-it`.[^eslint]
- The title of a test describes the intended behavior and starts with "should", for example `test("should reject a partial version")`. ESLint checks this with the rule `vitest/valid-title`.[^eslint]
- A unit test tests one module and calls that module directly. A test that reaches a module only through another module is an integration test (see [Kinds of tests](testing.md#kinds-of-tests)).
- A test file tests one feature. Tests for the same feature are not scattered over several test files.
- Two tests do not test exactly the same thing.
- Bigger XML or XSD snippets go into `__tests__/test-resources` and are reused where possible.

# Documentation

The documentation of the library and the generator is the knowledge bundle in `docs/`, in the Open Knowledge Format; [the index](index.md) lists its documents.[^okf]

- **Keep it current.** When a change affects what a document describes, update the document in the same change. Then set its `generated` to the person responsible for the content (`by: human:<GitHub user>`, also when an agent wrote the text) and the current time (UTC), set `status: draft` and remove `verified`, and add an entry to [the log](log.md), newest date first. When the maintainer has approved the document, set `status: stable` and add `verified` with `by: human:<GitHub user>` and the time.
- **Known issues.** Record problems you find outside the current task in [Known issues](known-issues.md), sorted by severity and effort, and remove them when they are fixed. A change to the known issues is a change like any other.
- **Workarounds for dependencies.** A workaround for a problem in a dependency gets a known issue that links the upstream issue and lists what to remove, a test in `__tests__/upstream-behavior.test.ts` that fails when the dependency fixes the problem (see [Testing](testing.md#kinds-of-tests)), and a comment `Upstream: <repo>#<number>` at the code it affects.
- **New documents** get front matter (`type`, `title`, a one-sentence `description`, `tags`, `status`, `generated`, `sources`), an entry in the index with the same description, and a log entry.
- **GitHub issues.** Documents mention GitHub issues only where a reader needs them. Which issue does which work is tracked on the [project board](agent-instructions/project-board.md), not in the documents. Examples where issues are needed:
  - known issues link the GitHub issue that tracks them;
  - an ADR names the issue it comes from (`**Issue:**`) and may link the issues of the parts it affects;
  - an issue of a dependency can be a source.
- **Sources.** Each source has an `id`, a relative `resource` and a `title`. Important statements get a footnote `[^id]` whose text is the title of the source. Separate the footnote definitions with blank lines.
- **Format.** Files use LF line endings, which `.gitattributes` (`* text=auto`) makes Git store for every text file. Links are relative; code and file paths are formatted as code, without line numbers. A document describes the current state and decided future work, not its own history; the history goes into the log. The rejected alternatives of an ADR are reasons, not history. No volatile numbers such as test counts or durations.
- **Diagrams.** Mermaid diagrams use one arrow with a combined label for both directions, so that labels do not overlap. Check that a diagram renders with `npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.png`.
- **Architecture decisions** are recorded as Architecture Decision Records (ADRs) in `docs/architecture/`, one decision per file, named `NNN-title.md` with a three-digit number in the order they are written. Numbers are not reused. A decision gets an ADR if it is hard to reverse, shapes several parts of the code or the public API, or has reasons that would otherwise get lost, such as an alternative that was rejected but may look attractive later. Smaller decisions are described in the document of the part they concern.
  - **Form.** The front matter is that of every new document, with `type: Architecture Decision Record` and the title `ADR NNN: <title>`. Below the heading follow `**Status:**` (Proposed or Accepted), `**Date:**` (when the decision was accepted or last changed) and `**Issue:**` (the GitHub issue, if there is one). The sections are Context, Decision, Reasons, Consequences, Rejected alternatives and Review (when to check whether the decision still holds); further sections where the decision needs them.
  - **Status.** A new ADR has the status Proposed and becomes Accepted when the maintainer approves the decision. Whether the text is approved is shown by `status` and `verified` in the front matter, as for every document.
  - **Living documents.** When a decision changes, its ADR is updated in the same change. The former decision moves to the rejected alternatives, with the reason it was given up, and the log records the change. An ADR whose decision no longer applies at all is removed.
  - **Links.** The documents that describe the code link the ADRs that explain why it is built that way, and do not repeat their reasons.
- **README, contributing and changelog.** `README.md` is written for users and describes the state of the branch it is on; information for contributors goes into [`CONTRIBUTING.md`](../CONTRIBUTING.md). `CHANGELOG.md` records the functional changes of the package under "Unreleased"; changes of the documentation only go into [the log](log.md).

# Before committing

1. `npm run lint` passes.
2. `npm test` passes; it first builds the library and type-checks the scripts (`pretest`).[^manifest]
3. The changes follow these guidelines.
4. The documentation is updated, and `CHANGELOG.md` for functional changes.
5. Copilot code review has checked the changed files; agents without it review them as described in [`AGENTS.md`](../AGENTS.md#essentials).

# Commits

- Each commit has one purpose and a clear message.
- A change that is reviewed in steps can be committed after each step. Before it is merged, the commits are combined so that each remaining commit has one purpose: the message of the first commit is reworded to describe the whole change, and the later commits are marked as `fixup` with `git rebase -i`. Do not use `squash`, because it combines the messages.
- Rewriting commits that were already pushed needs a force push. Agree on it with the others who work on the branch.

[^manifest]: Package manifest (scripts)

[^eslint]: ESLint configuration

[^jscpd]: jscpd configuration

[^fallow]: fallow configuration

[^tsconfig]: TypeScript configuration of the library

[^agents]: Instructions for AI coding agents

[^okf]: Open Knowledge Format specification
