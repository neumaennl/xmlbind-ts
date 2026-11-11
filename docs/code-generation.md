---
type: Reference
title: Code generation
description: How xsd2ts turns an XSD into decorated TypeScript classes - the command line and generateFromXsd(), the generated files, the mapping of names, types, elements, attributes, groups, references and derivations, and the XSD constructs it does not support.
tags: [xsd2ts, generator, xsd, code-generation, cli]
status: stable
generated: { by: human:neumaennl, at: 2026-11-11T13:05:00Z }
verified: { by: human:neumaennl, at: 2026-11-11T13:12:15Z }
sources:
  - id: cli
    resource: ../src/xsd/cli.ts
    title: xsd2ts command line interface
  - id: cleanup
    resource: ../src/xsd/fileCleanup.ts
    title: Cleanup of the output folder
  - id: generator
    resource: ../src/xsd/TsGenerator.ts
    title: Entry point of the generator
  - id: parser
    resource: ../src/xsd/XsdParser.ts
    title: XSD parser
  - id: schema
    resource: ../src/xsd/tsgen/schema.ts
    title: Index of the schema
  - id: codegen
    resource: ../src/xsd/tsgen/codegen.ts
    title: Names, namespaces and type resolution
  - id: types
    resource: ../src/xsd/tsgen/types.ts
    title: Mapping of XSD types
  - id: classgen
    resource: ../src/xsd/tsgen/classgen.ts
    title: Generation of classes
  - id: toplevel
    resource: ../src/xsd/tsgen/toplevel.ts
    title: Top-level elements
  - id: elements
    resource: ../src/xsd/tsgen/elements.ts
    title: Elements and compositors
  - id: restriction
    resource: ../src/xsd/tsgen/restriction-helpers.ts
    title: Attributes of restricted types
  - id: simpletypes
    resource: ../src/xsd/tsgen/simpletypes.ts
    title: Simple types
  - id: writer
    resource: ../src/xsd/tsgen/writer.ts
    title: Writer of the generated files
  - id: xmlschema
    resource: ../__tests__/test-resources/XMLSchema.xsd
    title: XSD schema for schemas, used as a test resource
---

# Purpose

`xsd2ts` reads one XSD file and writes TypeScript classes with the [decorators](decorators.md) of the library, so that documents of that schema can be [unmarshalled and marshalled](marshalling.md). This document describes how to run it, which files it writes, how XSD constructs map to TypeScript, and what it does not support. The statements were checked against generated output, in particular the classes generated from the XSD schema for schemas, `__tests__/test-resources/XMLSchema.xsd`.[^xmlschema]

# Running the generator

```bash
xsd2ts -i schema.xsd -o src/generated
```

| Option | Meaning |
|---|---|
| `-i, --input <file>` | the XSD file; required |
| `-o, --out <dir>` | the output folder; created if missing; required |
| `--force` | delete existing files without asking |
| `--no-delete` | keep the existing files; generated files are overwritten |
| `--no-import-extensions` | write relative imports without the `.js` extension |

Before generating, `xsd2ts` deletes all `.ts` files in the output folder, not only generated ones.[^cli] Without `--force`, it lists them and asks for confirmation; answering no ends the command without generating anything.[^cleanup] The output folder should therefore contain only generated files.

Relative imports in the generated files end in `.js`, as native ES modules with `moduleResolution: "nodenext"` require. `--no-import-extensions` writes them without an extension, for projects that resolve modules the older way.

The same generation is available as a function; it neither deletes nor asks:[^generator]

```typescript
import { generateFromXsd } from "@neumaennl/xmlbind-ts";

generateFromXsd(xsdText, "src/generated");        // with .js extensions
generateFromXsd(xsdText, "src/generated", false); // without
```

`generateFromXsd()` takes the content of the XSD, not a file name, and throws `No schema` if the document has no `schema` element.

# Generated files

| File | Content |
|---|---|
| `<Class>.ts` | one class per complex type and per top-level element, with the imports it needs |
| `enums.ts` | all enumerations, as TypeScript `enum`s |
| `types.ts` | all union and list types, as type aliases |
| `index.ts` | a barrel file that re-exports everything |

Each file starts with a comment that it was generated.[^writer] The classes import the decorators from `@neumaennl/xmlbind-ts`, so the package is a runtime dependency of the code that uses them.

# How the schema is read

The generator parses the XSD with `@xmldom/xmldom` and finds the `schema` element by the XSD namespace `http://www.w3.org/2001/XMLSchema`, with any prefix.[^parser] It indexes the top-level complex types, simple types, groups, attribute groups, attributes and elements of that one file.[^schema] Then it generates:

1. the enumerations and the union and list types of the named simple types;
2. a class for each named complex type;
3. a class for each top-level element.

References to types, groups and elements are resolved by their local name; the prefix and its namespace are ignored.[^codegen] `xs:import` only adds a prefix for the imported namespace; the imported schema is not read, and neither are `xs:include`, `xs:redefine` and `xs:override` (see [Imported and included schemas are not read](known-issues.md#imported-and-included-schemas-are-not-read)).

# Names

- **Classes** have the name of the XSD type or element, with its case unchanged. Characters that are not allowed in an identifier become `_`, and leading digits are removed: `my-type` becomes `my_type`.
- **Properties** have the name of the element or attribute, sanitized in the same way. The decorator keeps the XML name.
- **Reserved words** of JavaScript and TypeScript and the names of built-in types, such as `class`, `string` or `any`, get the suffix `_`: an element `class` becomes the property `class_`.
- **Anonymous complex types** of local elements become a class `<element>Type`, for example `inlineType` for the element `inline`.
- **A top-level element with the name of a type** becomes `<element>Element`. An element `kitchen` of type `kitchen` gives the classes `kitchen` and `kitchenElement`.
- **Enumeration values** keep their value; their keys are sanitized, so `dark-blue` becomes `dark_blue = "dark-blue"`.[^codegen]

Not all generated references use the sanitized names (see [Names with hyphens produce code that does not compile](known-issues.md#names-with-hyphens-produce-code-that-does-not-compile)), and properties are not checked for duplicates (see [Properties with the same name produce code that does not compile](known-issues.md#properties-with-the-same-name-produce-code-that-does-not-compile)).

# Types

| XSD type | TypeScript type | Decorator `type` |
|---|---|---|
| `string`, `normalizedString`, `token`, `language`, `Name`, `NCName`, `ID`, `IDREF`, `ENTITY`, `NMTOKEN`, `anyURI`, `QName`, `NOTATION`, `hexBinary`, `base64Binary` | `string` | `String` |
| `boolean` | `boolean` | `Boolean` |
| `int`, `integer`, `long`, `short`, `byte`, `decimal`, `float`, `double`, the unsigned and the positive and negative integer types | `number` | `Number` |
| `date`, `dateTime`, `time`, `duration`, `gYear`, `gYearMonth`, `gMonth`, `gMonthDay`, `gDay` | `Date` | `Date` |
| `anyType`, `anySimpleType` | `any` | none |
| a named complex type | its class | `() => Class` |
| an enumeration | its `enum` | none |
| a union | a type alias, such as `number \| "auto"` | `Number` or `Boolean` if exactly one of them is a member, with `allowStringFallback` if there are other members; otherwise none |
| a list | a type alias, such as `number[]` | none for attributes, `() => Alias` for elements |
| any other simple type | the type of its base, following the restrictions | as for the base |

Some of these mappings lose information or do not work:[^types]

- `long`, `integer` and `decimal` values beyond the precision of a JavaScript number change (see [Large integers and decimals lose precision](known-issues.md#large-integers-and-decimals-lose-precision)).
- `time`, `duration` and the `g…` types cannot be represented as a `Date` (see [Times, durations and partial dates are mapped to `Date`](known-issues.md#times-durations-and-partial-dates-are-mapped-to-date)), and dates are written in UTC (see [Dates are written as date and time in UTC](known-issues.md#dates-are-written-as-date-and-time-in-utc)).
- Enumerations get no decorator `type`, so their values are not converted (see [Enum objects as `type` are ignored](known-issues.md#enum-objects-as-type-are-ignored)).
- Lists are not split into items at runtime, and a list as element type does not compile (see [List types are not supported](known-issues.md#list-types-are-not-supported)).

Facets other than enumerations, such as `pattern`, `length` or `minInclusive`, are ignored; the generated classes do not validate.

# Classes

Each named complex type becomes a class, and so does each top-level element. Every generated class except the `<element>Type` classes described below has `@XmlRoot`, with the name of the type or element, the target namespace, and as `prefixes` all namespace declarations of the `schema` element plus a generated prefix `imp1`, `imp2` and so on for imported namespaces without one.[^classgen] So any generated class can be marshalled as a root; for a type class, the root element gets the type's name.

## Top-level elements

| Top-level element | Generated class |
|---|---|
| `type` is a complex type | a class that extends the type's class, with no own fields |
| `type` is an enumeration or another simple type, or a built-in type | a class with an `@XmlText()` field `value` |
| an anonymous complex type | a class with the element's name and the type's content; if other elements refer to the element with `ref`, the content goes into a class `<element>Type`, and the element's class extends it |
| an anonymous simple type | a class with an `@XmlText()` field `value` |
| no type at all, or a type from another schema | nothing |

The table follows the generator's code for top-level elements.[^toplevel]

The classes of top-level elements also declare the field `_namespacePrefixes`, which `marshal()` reads (see [Marshalling](marshalling.md#namespaces-and-prefixes)).

When `<element>Type` already exists, the class gets a suffix, `<element>Type_1`. Properties that refer to such an element with `ref` are then typed with the colliding class instead ([#278](https://github.com/neumaennl/xmlbind-ts/issues/278)).

## Elements

Each element in a `xs:sequence`, `xs:choice` or `xs:all` becomes a property with `@XmlElement`, in the order of the schema.[^elements]

- **Arrays.** A property is an array (`array: true`) if the element has `maxOccurs` greater than 1 or `unbounded` or `minOccurs` greater than 1, or if a surrounding compositor or group reference can occur more than once.
- **Optional properties.** A property is optional (`name?: Type`) if the element has `minOccurs="0"`, if it is in a `xs:choice`, or if a surrounding compositor or group reference has `minOccurs="0"`. Otherwise it is declared with a definite assignment assertion (`name!: Type`), although nothing guarantees that the value is set.
- **Namespaces.** An element gets `namespace` if it is qualified: a top-level element, or a local element with `form="qualified"` or, without `form`, under `elementFormDefault="qualified"`.
- **Nil.** `nillable="true"` adds `nillable: true` and `| null` to the property type.
- **References.** `<xs:element ref="x"/>` becomes a property named after the referenced element, with its type.
- **Repeated choices.** The elements of a `xs:choice` with `maxOccurs="unbounded"` become one array per element; which occurrence came first across the elements is not represented (see [Elements are reordered when occurrences are not contiguous](known-issues.md#elements-are-reordered-when-occurrences-are-not-contiguous)).
- **Wildcards.** `xs:any` becomes `_any?: unknown[]` with `@XmlAnyElement()`; its `namespace` and `processContents` are not used.
- **Default and fixed values** are not applied (see [Default and fixed values are ignored](known-issues.md#default-and-fixed-values-are-ignored)).

## Attributes

Each attribute becomes a property with `@XmlAttribute`. It is required (`!`) with `use="required"` and optional otherwise; `use="prohibited"` leaves it out. An attribute gets `namespace` if it is qualified, by `form` or `attributeFormDefault`. `xs:anyAttribute` becomes `_anyAttributes?: { [name: string]: string }` with `@XmlAnyAttribute()`.

## Groups and attribute groups

References to `xs:group` and `xs:attributeGroup` are expanded: their elements and attributes become properties of the class that refers to them, as if they were written there. No class is generated for a group.[^elements]

## Mixed and simple content

- **Mixed content** (`mixed="true"`) adds an `@XmlText()` field `value?: string` to the class's other properties (see [Marshalling](marshalling.md#binding) for how text is read).
- **Simple content** (`xs:simpleContent`) becomes a class with an `@XmlText()` field `value`, typed with the base type, and the attributes of the extension or restriction. The `@XmlText()` decorator has no `type` option, so the text is not converted to that type (see [`@XmlText()` fields are not converted to their type](known-issues.md#xmltext-fields-are-not-converted-to-their-type)). If the base is itself a complex type with simple content, the class gets neither the base's attributes nor a valid type for `value` (see [Simple content derived from a complex type is wrong](known-issues.md#simple-content-derived-from-a-complex-type-is-wrong)).[^classgen]

# Derivation

The two kinds of complex type derivation map differently:

- **`xs:extension` becomes `extends`.** The derived class extends the class of its base and adds the extension's elements and attributes. With the XSD schema for schemas, `facet extends annotated` and `annotated extends openAttrs`.
- **`xs:restriction` becomes a standalone class.** The class does not extend its base. It gets the base's attributes, including those the base inherits, except the attributes that the restriction or a restriction further up the chain prohibits or redefines, and only the elements that the restriction lists. With the XSD schema for schemas, `topLevelElement` and `localElement` restrict `element`, and `explicitGroup` restricts `group`, but none of them extends its base.[^restriction] Attributes that the base declares with `ref` are left out, and attribute groups that the restriction repeats give duplicate properties (see [A restriction drops the attribute references of its base](known-issues.md#a-restriction-drops-the-attribute-references-of-its-base) and [Attributes of attribute groups in a restriction are generated twice](known-issues.md#attributes-of-attribute-groups-in-a-restriction-are-generated-twice)).

This is deliberate. A restriction can take things away from its base: prohibit an attribute, remove optional child elements, tighten occurrence limits or narrow value types. A TypeScript subclass can narrow a property's type, but it cannot remove an inherited property. If a restricted type extended its base, its class would declare attributes and elements that the schema forbids, and it would break substitutability: a `topLevelElement` must not have `minOccurs`, but as a subclass of `element` it would.

The restriction chain is followed: `simpleExplicitGroup` restricts `explicitGroup`, which restricts `group`. `explicitGroup` leaves out `name` and `ref`, which its restriction prohibits, and `simpleExplicitGroup` additionally leaves out `minOccurs` and `maxOccurs`. Attributes that a base inherits by extension, such as the attribute wildcard of `openAttrs`, are copied into the restricted class.

The trade-off: there is no common type for a base and its restrictions, so code that handles both uses a union such as `topLevelElement | localElement`. A generated interface with the members that the base and all its restrictions have in common was considered. TypeScript already allows access to the members that all types of a union share, so such an interface would mainly give the union a name, which a generated type alias would do as well. Whether the generator should create such a type is open ([#282](https://github.com/neumaennl/xmlbind-ts/issues/282)).

Simple type derivation by restriction maps to the base type, or to an `enum` if the restriction has enumerations.[^simpletypes] Substitution groups and `abstract` are not supported: an element in a substitution group is generated like any other top-level element, and a property for the head element does not accept the members (see [Substitution groups and `abstract` are not supported](known-issues.md#substitution-groups-and-abstract-are-not-supported)).

# Documentation

The text of the first `xs:documentation` in a type's or element's `xs:annotation` becomes the TSDoc comment of the class or property; markup in it is reduced to its text.

# Not supported

- `xs:import`, `xs:include`, `xs:redefine` and `xs:override` of other files
- substitution groups, `abstract`, and `xsi:type` at runtime
- default and fixed values
- facets other than enumerations, and validation in general
- identity constraints (`xs:key`, `xs:keyref`, `xs:unique`) and `xs:notation`
- XSD 1.1 constructs such as `xs:assert`, `xs:alternative` and `xs:openContent`
- the `namespace` and `processContents` of wildcards

[^cli]: xsd2ts command line interface

[^cleanup]: Cleanup of the output folder

[^generator]: Entry point of the generator

[^writer]: Writer of the generated files

[^parser]: XSD parser

[^schema]: Index of the schema

[^codegen]: Names, namespaces and type resolution

[^types]: Mapping of XSD types

[^classgen]: Generation of classes

[^toplevel]: Top-level elements

[^elements]: Elements and compositors

[^restriction]: Attributes of restricted types

[^simpletypes]: Simple types

[^xmlschema]: XSD schema for schemas, used as a test resource
