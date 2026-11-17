---
type: Architecture Decision Record
title: "ADR 002: slimdom as the XML library"
description: The decision to parse and write XML with slimdom, to support XML 1.0 only, and to get the source ranges of the nodes through a pull request to slimdom, with the measurements of the candidates and the rejected alternatives.
tags: [adr, architecture, xml, parser, serializer, dom, source-ranges]
status: draft
generated: { by: human:neumaennl, at: 2026-11-15T10:42:34Z }
sources:
  - id: issue-301
    resource: https://github.com/neumaennl/xmlbind-ts/issues/301
    title: Choose the XML library of version 3 (#301)
  - id: adr-001
    resource: 001-reimplementation.md
    title: "ADR 001: Reimplementation of xmlbind-ts as version 3"
  - id: xmlconf
    resource: https://www.w3.org/XML/Test/
    title: W3C XML Conformance Test Suite
  - id: slimdom-148
    resource: https://github.com/bwrrp/slimdom.js/issues/148
    title: Add optional way to track positions in parser (slimdom#148)
  - id: xmldom-506
    resource: https://github.com/xmldom/xmldom/issues/506
    title: Any way to get "raw" node value without escaping? Or its absolute position? (xmldom#506)
  - id: xmldom-42
    resource: https://github.com/xmldom/xmldom/issues/42
    title: "DOMParser: Wrong data in PI element (xmldom#42)"
  - id: xmldom-1000
    resource: https://github.com/xmldom/xmldom/issues/1000
    title: XMLSerializer does not check Element or Attribute well-formedness (xmldom#1000)
  - id: known-issues-240
    resource: https://github.com/neumaennl/xmlbind-ts/blob/2.4.0/docs/known-issues.md
    title: Known issues of version 2.4.0
  - id: dom-parsing
    resource: https://w3c.github.io/DOM-Parsing/
    title: DOM Parsing and Serialization
---

# ADR 002: slimdom as the XML library

**Status:** Accepted  
**Date:** 2026-11-15  
**Issue:** [#301](https://github.com/neumaennl/xmlbind-ts/issues/301)

## Context

[ADR 001](001-reimplementation.md#principles) requires that version 3 parses and writes XML with a standard-conformant, actively maintained library, not with a parser or serializer of its own.[^adr-001] The library must run in Node.js and in browsers.

A round trip writes only the changed parts of a document. For this, xmlbind-ts must know where each part of the source starts and ends:

- start tags and end tags;
- attributes and their values;
- text, comments and processing instructions;
- the XML declaration and the document type.

All offsets must refer to the string that the application passed in.[^issue-301]

## Decision

- **slimdom** parses and writes XML in version 3. It is used through `parseXmlDocument()`, `parseXmlFragment()` and `serializeToWellFormedString()`, and otherwise through the standard DOM API.
- **XML 1.0 only.** `unmarshal()` rejects a document that declares `version="1.1"` and reports why. This does not exclude XSD 1.1: its schema documents are XML 1.0 documents.
- **The source ranges come from slimdom.** xmlbind-ts implements [slimdom#148](https://github.com/bwrrp/slimdom.js/issues/148) as a pull request.[^slimdom-148] The issue is the maintainer's own plan. The parser fills an optional map from nodes to their ranges. The ranges of a node are a tagged union with one variant per kind of node:

  | Node                                                          | Ranges                                                                |
  | ------------------------------------------------------------- | --------------------------------------------------------------------- |
  | Element                                                       | the start tag or the empty-element tag; the end tag                   |
  | Attribute                                                     | the whole attribute; its value including the quotes                   |
  | Text                                                          | from the start of its first piece to the end of its last piece        |
  | CDATA section, comment, processing instruction, document type | the whole node                                                        |
  | XML declaration                                               | the whole declaration, kept for the document because it is not a node |
  | Text declaration of a fragment                                | the whole declaration, kept for the document fragment                 |
  - Nodes from the replacement text of an entity get no range of their own. Neither do attributes that the DTD adds as defaults.
  - The offsets refer to the original string, before the byte order mark is removed and the line ends are normalized.

- **If no released version of slimdom has the ranges when the binder ([#303](https://github.com/neumaennl/xmlbind-ts/issues/303)) needs them,** xmlbind-ts uses the change from a temporary fork of slimdom until it is released. The pull request stays open upstream.

  The fork gets:
  - a known issue that links slimdom#148 and lists what to remove;
  - a test in `__tests__/upstream-behavior.test.ts`.

## Reasons

The candidates were measured in a setup outside the repository on 2026-11-14.

### Conformance

The [W3C XML Conformance Test Suite](https://www.w3.org/XML/Test/) (`xmlts20130923`) was run with the tests for a namespace-aware, non-validating XML 1.0 parser:[^xmlconf]

- 1821 XML tests;
- 48 namespace tests.

| Candidate                                   | Not well-formed, rejected | Well-formed, accepted | Content as expected | Namespace errors rejected |
| ------------------------------------------- | ------------------------- | --------------------- | ------------------- | ------------------------- |
| `slimdom` 4.3.5                             | 896 / 897                 | 914 / 924             | 248 / 248           | 24 / 24                   |
| `@xmldom/xmldom` 0.9.12, stopping on errors | 744 / 897                 | 841 / 924             | 208 / 218           | 11 / 24                   |
| `@rgrove/parse-xml` 5.2.0                   | 596 / 897                 | 841 / 924             | 208 / 218           | 2 / 24                    |
| `sax` 1.6.1, strict                         | 355 / 897                 | 532 / 924             | 143 / 217           | 7 / 24                    |

slimdom rejects 10 well-formed documents:

- Nine refer to entities declared in an external DTD or an external parameter entity, which slimdom does not read.
- One (`rmt-e3e-13`) refers to an undeclared entity after a reference to a parameter entity. That is only a validity error, but slimdom treats it as a well-formedness error.

### The known issues of 2.4.0

Seven [known issues of 2.4.0](https://github.com/neumaennl/xmlbind-ts/blob/2.4.0/docs/known-issues.md) depend on the library.[^known-issues-240] slimdom handles all of them:

| Known issue                                                | With slimdom                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `unmarshal()` parses every document twice                  | Impossible by design: one parse creates the DOM and the ranges.                             |
| Leading and trailing whitespace of element text is removed | Text nodes keep it.                                                                         |
| Characters that XML does not allow are written             | `serializeToWellFormedString()` rejects them in text, attribute values, comments and names. |
| Line feeds and tabs in attribute values are not normalized | The parser normalizes them; the serializer writes them as `&#10;` and `&#9;`.               |
| Invalid character references are removed without an error  | The parser rejects them.                                                                    |
| The output of `marshal()` starts with a line break         | The serializer adds no whitespace.                                                          |
| Mixed content gets a line with only spaces                 | The same.                                                                                   |

The binder ([#303](https://github.com/neumaennl/xmlbind-ts/issues/303)) covers each of them with a test.

### Further properties of slimdom

- It writes `xmlns=""` for an element without a namespace below a default namespace. This was the known issue "Elements without a namespace are written into the default namespace" of 2.4.0.
- It declares undeclared prefixes when writing, and keeps namespace declarations where they are.
- It rejects the same attribute written twice through two prefixes of one namespace.
- It treats NEL and LS as characters, not as line ends, as XML 1.0 requires.
- It applies the internal subset of the document type: entities, default attributes and the normalization of declared attributes.
- It has no dependencies.
- It runs in Node.js and in browsers: about 20 KB minified and gzipped.
- Performance is similar to `@xmldom/xmldom`. A 50 MB document takes about 5 s to parse and 1.5 GB of heap.

### Why the source ranges come from a pull request

- No candidate provides the ranges:
  - `@xmldom/xmldom` records only where a node or an attribute name starts;
  - `slimdom` records nothing;
  - `@rgrove/parse-xml` and `sax` record whole nodes or events, but are not DOMs.
- slimdom#148 plans exactly this feature, in the form the binder needs: an optional map from nodes to ranges.[^slimdom-148]
- The grammar of slimdom already records offsets for names, references, CDATA sections and end tags. The pull request extends this to the other productions. It translates the offsets back to the original string.
- The maintainer agreed to the design of the pull request on slimdom#148.

## Consequences

- `slimdom` becomes a runtime dependency of xmlbind-ts. The binder adds it to `package.json`.
- Parse errors give their line and column only in the message text. The pull request for slimdom#148 does not change this. If xmlbind-ts needs them as properties, this is a separate change to slimdom.
- The DOM does not keep the XML declaration or the internal subset of the document type. Writing only the changes keeps their text through the ranges.
- The serializer writes a carriage return in text as it is, as the [DOM Parsing standard](https://w3c.github.io/DOM-Parsing/) says, so it becomes a line feed when the document is parsed again.[^dom-parsing] The binder decides how to write such values.
- A document with `version="1.1"` is rejected, even where its content would also be valid XML 1.0.
- The binder waits for the ranges. Parts that don't need them go on.

## Rejected alternatives

- **`@xmldom/xmldom`.** Actively maintained, but it does not conform in ways that matter to xmlbind-ts:
  - it accepts characters that XML does not allow and invalid character references such as `&#1;`, and inserts the character;
  - it accepts unquoted attribute values (with a warning only) and the same attribute twice through two prefixes;
  - it does not apply entity declarations of the internal subset; in its default mode the text then contains the reference, such as `&e;`;
  - it treats NEL and LS as line ends, as in XML 1.1;
  - it returns the XML declaration as a processing instruction, which its own serializer rejects with `requireWellFormed` ([xmldom#42](https://github.com/xmldom/xmldom/issues/42));[^xmldom-42]
  - its serializer writes characters that XML does not allow in attribute values ([xmldom#1000](https://github.com/xmldom/xmldom/issues/1000)) and no `xmlns=""`.[^xmldom-1000]

  Getting the source ranges would add to these fixes. Its maintainer did not want exact positions and considered removing the locator ([xmldom#506](https://github.com/xmldom/xmldom/issues/506)).[^xmldom-506]

- **`@rgrove/parse-xml`.** It records the start and end offsets of nodes in the original string. But it is not a DOM, does not process namespaces and has no serializer. xmlbind-ts would have to build both itself, which ADR 001 rules out.
- **`sax`.** A streaming parser with positions per event. It is far from conformant, does not record positions for attributes, and is not a DOM.
- **A second parse to find the ranges,** with `@rgrove/parse-xml` or a lexer of our own, matched to the nodes of the DOM. This parses every document twice, a known issue of 2.4.0, and is a lexical layer of our own, which ADR 001 rules out.
- **XML 1.1.** It allows control characters as character references and treats NEL and LS as line ends. Hardly any documents use it, and none of the candidates supports it.
- **Libraries ruled out without measuring:**

  | Library                               | Reason                                                                                   |
  | ------------------------------------- | ---------------------------------------------------------------------------------------- |
  | `fast-xml-parser`, `fast-xml-builder` | lenient and no DOM; the cause of many known issues of 2.4.0                              |
  | `saxes`, `slimdom-sax-parser`         | `saxes` is archived; `slimdom-sax-parser` builds on it and has had no release since 2022 |
  | `jsdom`                               | parses XML with `saxes`; Node.js only                                                    |
  | `linkedom`                            | made for HTML; its XML mode does not conform                                             |
  | `@oozcitak/dom` (`xmlbuilder2`)       | a simple parser of its own, without a claim of conformance                               |
  | `libxml2-wasm`, `xmllint-wasm`        | WebAssembly with manual memory management; no source positions in the DOM                |
  | `@xml-tools/parser`                   | a fault-tolerant syntax tree for editors, without namespaces                             |
  | `htmlparser2`, `txml`                 | do not conform                                                                           |
  | `DOMParser` of the browser            | not available in Node.js; no positions                                                   |

## Review

- **When work on the binder starts,** if the change is not released: switch to the temporary fork.
- **When the change is released:** remove the fork, its known issue and its upstream test.
- **When slimdom stops being maintained,** for example when security problems stay unfixed: measure the candidates again.

[^issue-301]: Choose the XML library of version 3 (#301)

[^adr-001]: ADR 001: Reimplementation of xmlbind-ts as version 3

[^xmlconf]: W3C XML Conformance Test Suite

[^slimdom-148]: Add optional way to track positions in parser (slimdom#148)

[^xmldom-506]: Any way to get "raw" node value without escaping? Or its absolute position? (xmldom#506)

[^xmldom-42]: DOMParser: Wrong data in PI element (xmldom#42)

[^xmldom-1000]: XMLSerializer does not check Element or Attribute well-formedness (xmldom#1000)

[^known-issues-240]: Known issues of version 2.4.0

[^dom-parsing]: DOM Parsing and Serialization
