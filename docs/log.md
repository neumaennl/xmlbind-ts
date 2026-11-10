# Knowledge Bundle Update Log

## 2026-11-10
* **Update**: [Decorators](decorators.md#when-to-review) has a new section "When to review": when the recommendation of legacy decorators and the way the tests compile decorators are reviewed. [#290](https://github.com/neumaennl/xmlbind-ts/issues/290) tracks the review; it is blocked by [oxc-project/oxc#9170](https://github.com/oxc-project/oxc/issues/9170) and relates to [neumaennl/vscode-visual-xml-schema-editor#434](https://github.com/neumaennl/vscode-visual-xml-schema-editor/issues/434).

## 2026-11-09
* **Update**: The [index](index.md#agent-instructions) explains the new folder `agent-instructions/`, which holds instructions for agents, starting with [how they use the project board](agent-instructions/project-board.md); `AGENTS.md` links it.
* **Update**: [Known issues](known-issues.md): "Character references are not decoded" links [#287](https://github.com/neumaennl/xmlbind-ts/issues/287), and "The attributes of the XML declaration are not kept" links [#288](https://github.com/neumaennl/xmlbind-ts/issues/288).

## 2026-11-07
* **Update**: [Architecture](architecture.md#scope) has a new section "Scope": a table of what xmlbind-ts is responsible for and what belongs to the application, and the rule of thumb that decides between them.
* **Update**: [Build and release](build-and-release.md): `tsconfig.target.json` holds only the ECMAScript edition of the supported Node.js version, as `target` and `lib`, without the `ESNext.*` libraries of `@tsconfig/bases`, and `npm run node:check` runs without the dependencies, as in CI.
* **Update**: [Build and release](build-and-release.md) describes `tsconfig.target.json`, which holds the compiler target of the supported Node.js version from `@tsconfig/bases`, and how `npm run node:update` and `npm run node:check` keep it in line ([#283](https://github.com/neumaennl/xmlbind-ts/issues/283)).
* **Update**: [Testing](testing.md) describes that the Vitest plugin and the tests that compile projects take the target from `tsconfig.target.json`, and the helper `compilerTarget()`. The [development guidelines](development-guidelines.md) and `CONTRIBUTING.md` say that the Node.js version decides the compiler target.

## 2026-11-06
* **Update**: [Development guidelines](development-guidelines.md) link the index, the log, the known issues and `CONTRIBUTING.md`, which they named as paths before, link the documents of their topics and the known issues of their rules, and point to [Build and release](build-and-release.md#nodejs-version) instead of the removed README section for the Node.js version. `AGENTS.md` links `CONTRIBUTING.md`, the index and the known issues, and asks agents to look at the open GitHub issues when they plan fixes.
* **Update**: Created `CONTRIBUTING.md` for contributors: setup, everyday commands, the Node.js version, the rules, how pull requests are checked, and the documentation. It takes over the sections "Contributing" and "Node.js version for development" of the former `README.md`.

## 2026-11-05
* **Creation**: Established the [Testing](testing.md) concept.
* **Update**: Added to [Known issues](known-issues.md) that the tests are not type-checked and that some test files are named after issues and scatter features, and that coverage is measured for `src/` only.
* **Creation**: Established the [Build and release](build-and-release.md) concept, with the Node.js version policy and its scripts from `README.md`. The open strategy for the compiler target is [#283](https://github.com/neumaennl/xmlbind-ts/issues/283).
* **Update**: Added the section "Build and release" to [Known issues](known-issues.md), with "The package contents are defined by a list of exclusions" and "CI builds twice".
* **Creation**: Established the [index](index.md) and this log.
* **Update**: Removed a source without a footnote from [Architecture](architecture.md).
* **Update**: `README.md` is written for users: installation from GitHub Packages with the token it needs, the supported setup, a quick start, an `xsd2ts` example, the main limitations and links into the bundle. The decorator reference, marshalling, namespace prefixes, the supported XSD features, requiredness, the type mapping and enums moved into [Decorators](decorators.md), [Marshalling](marshalling.md) and [Code generation](code-generation.md); the claims that imports have basic support and lists are supported, and the type `String` in the requiredness example, were wrong and are gone. The anchor `#typescript-decorator-support` is kept.

## 2026-11-04
* **Update**: [Code generation](code-generation.md) links [#282](https://github.com/neumaennl/xmlbind-ts/issues/282), which asks whether the generator should create a common type for a complex type and its restrictions.

## 2026-11-03
* **Update**: Added to [Known issues](known-issues.md), found while writing [Marshalling](marshalling.md): `unmarshal()` parses every document twice, infinities are not converted to and from `INF`, dates are written as date and time in UTC, the attributes of the XML declaration are not kept, `null` entries of arrays are written as empty elements at the front, and empty values become `0`, `false` or an invalid date.
* **Creation**: Established the [Code generation](code-generation.md) concept, with the mapping of XSD derivation to classes from [#250](https://github.com/neumaennl/xmlbind-ts/issues/250).
* **Update**: Added thirteen problems of the generator to [Known issues](known-issues.md), among them [#278](https://github.com/neumaennl/xmlbind-ts/issues/278), and the rule that an entry keeps its severity and effort when it gets a GitHub issue.

## 2026-11-02
* **Creation**: Established the [Marshalling](marshalling.md) concept, with the namespace prefix mappings from `README.md`.
* **Update**: Added thirteen round-trip and marshalling problems to [Known issues](known-issues.md), among them the reordering of elements and the handling of mixed content.

## 2026-10-30
* **Initialization**: Created the knowledge bundle in the Open Knowledge Format v0.2 ([#250](https://github.com/neumaennl/xmlbind-ts/issues/250)). It describes the library and the generator as they are on `main`.
* **Creation**: Established the [Development guidelines](development-guidelines.md), with the rules of the former `.github/agents/my-agent.agent.md`, and `AGENTS.md` in the repository root.
* **Creation**: Established the [Architecture](architecture.md) concept.
* **Creation**: Established [Known issues](known-issues.md), with the size limits, the use of `any`, the style of the tests, the coverage and four problems of the public API.
* **Creation**: Established the [Decorators](decorators.md) concept, with the decorator reference from `README.md`.
* **Update**: Added ten problems of the decorators and the marshalling to [Known issues](known-issues.md), among them [#275](https://github.com/neumaennl/xmlbind-ts/issues/275) and [#276](https://github.com/neumaennl/xmlbind-ts/issues/276).
