---
okf_version: "0.2"
---

# Overview

* [Architecture](architecture.md) - What xmlbind-ts is responsible for and what belongs to the application, how the package is divided into the runtime library and the xsd2ts generator - their modules, the public API of the entry point, the runtime dependencies, and the principles the code follows.

# Working on the library

* [Development guidelines](development-guidelines.md) - Rules for everyone who changes the library or the generator - code size, code quality and ESLint, TypeScript, the Node version, TSDoc, tests, documentation and the knowledge bundle, what to check before committing, and commits.
* [Testing](testing.md) - How the library and the generator are tested - running the tests, the two Vitest projects for legacy and Stage 3 decorators, the test utilities and resources, the kinds of tests, coverage, CI, and what the tests do not cover.
* [Build and release](build-and-release.md) - How the package is built, linted, packaged and published - the npm scripts, the TypeScript configurations, the module format and the package contents, GitHub Packages, the Node.js version and its scripts, CI, Dependabot, and the changelog.

# XML binding

* [Decorators](decorators.md) - The decorators that map classes and fields to XML - what each one records, its options and defaults, how field types are resolved, how legacy and Stage 3 decorators reach the metadata registry, and the functions that read the metadata.
* [Marshalling](marshalling.md) - How unmarshal() turns an XML string into objects and marshal() turns them back - binding of attributes, elements, text and wildcards, value conversion, namespaces and prefixes, comments and order, the output format, and what a round trip keeps and changes.

# Code generation

* [Code generation](code-generation.md) - How xsd2ts turns an XSD into decorated TypeScript classes - the command line and generateFromXsd(), the generated files, the mapping of names, types, elements, attributes, groups, references and derivations, and the XSD constructs it does not support.

# Maintenance

* [Known issues](known-issues.md) - Problems found in the library, the generator and the project setup that are not fixed yet, with links to GitHub issues where they exist.
