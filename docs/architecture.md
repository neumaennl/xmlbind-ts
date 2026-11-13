---
type: Architecture
title: Architecture
description: What xmlbind-ts is responsible for and what belongs to the application, while version 3 is reimplemented.
tags: [architecture, scope]
status: draft
generated: { by: human:neumaennl, at: 2026-11-13T12:50:20Z }
sources: []
---

# Purpose

`@neumaennl/xmlbind-ts` binds XML documents to TypeScript classes in the style of JAXB: decorators describe how the fields of a class map to XML, `unmarshal()` creates an object from an XML string, and `marshal()` writes an object back to XML. The `xsd2ts` generator writes such decorated classes from an XML Schema (XSD).

This branch holds version 3, which is reimplemented in parts ([ADR 001](architecture/001-reimplementation.md)). The code of 2.x is removed; the [architecture of 2.4.0](https://github.com/neumaennl/xmlbind-ts/blob/2.4.0/docs/architecture.md) describes it. This document describes what xmlbind-ts is responsible for. The parts add the structure of their code here as they are implemented.

# Scope

xmlbind-ts is responsible for what every application that binds XML needs, whatever the format of its documents. What needs the rules of a particular format, or of the environment the application runs in, belongs to the application. As a rule of thumb: if an application that binds a completely different XML format would need it as well, it belongs in xmlbind-ts.

| Concern | Owner | Why |
|---|---|---|
| Parsing and writing XML, and the choice of the libraries that do it | xmlbind-ts | Every application needs it. |
| Decorators, the generator, and the conversion of values to the type of their field | xmlbind-ts | Generic binding mechanics. |
| Keeping the source of a document on a round trip: the order of the child elements, comments, processing instructions, namespace declarations and prefixes, attribute order, quotes, empty-element style and indentation | xmlbind-ts | Every application that writes a document back needs it. |
| Keeping content that no field maps | xmlbind-ts | The same. |
| Telling the caller what a round trip drops or changes | xmlbind-ts | Only xmlbind-ts sees it. These are facts, not decisions. |
| Testing round trips with real documents | xmlbind-ts | It owns the round trip. |
| What to do with a document that does not survive a round trip unchanged: warn, refuse to write it, or accept the loss | Application | A product decision. |
| Validating a document against its schema, and the meaning of values beyond the type of their field, such as resolving a QName to the component it names | Application | Needs the rules of the format. |
| Which schema the classes are generated from, and keeping them up to date | Application | Only the application knows its format. |

The generator reads a schema to write classes. The runtime library knows the lexical spaces of the built-in types of XSD and the attributes of the namespace `xsi`, but does not load a schema to bind a document (see [ADR 001](architecture/001-reimplementation.md#principles)). The classes the generator writes are ordinary decorated classes.
