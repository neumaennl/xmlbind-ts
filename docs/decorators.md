---
type: Reference
title: Decorators
description: The decorators that map classes and fields to XML - what each one records, its options and defaults, how field types are resolved, how legacy and Stage 3 decorators reach the metadata registry and when to review the recommendation of legacy decorators, and the functions that read the metadata.
tags: [decorators, metadata, legacy-decorators, stage3-decorators, public-api]
status: stable
generated: { by: human:neumaennl, at: 2026-11-11T16:07:13Z }
verified: { by: human:neumaennl, at: 2026-11-11T17:42:15Z }
sources:
  - id: xmlroot
    resource: ../src/decorators/XmlRoot.ts
    title: "@XmlRoot"
  - id: xmlelement
    resource: ../src/decorators/XmlElement.ts
    title: "@XmlElement"
  - id: xmlattribute
    resource: ../src/decorators/XmlAttribute.ts
    title: "@XmlAttribute"
  - id: xmltext
    resource: ../src/decorators/XmlText.ts
    title: "@XmlText"
  - id: field-type
    resource: ../src/decorators/fieldType.ts
    title: Type of a field from its declaration
  - id: xmlenum
    resource: ../src/decorators/XmlEnum.ts
    title: "@XmlEnum"
  - id: wildcards
    resource: ../src/marshalling/namespaceHelpers.ts
    title: Namespace and wildcard helpers for unmarshalling
  - id: registry
    resource: ../src/metadata/MetadataRegistry.ts
    title: Metadata registry
  - id: types
    resource: ../src/types.ts
    title: Metadata types
  - id: type-resolution
    resource: ../src/util/typeResolution.ts
    title: Resolution of lazy type references
  - id: unmarshal
    resource: ../src/marshalling/unmarshal.ts
    title: Unmarshalling
  - id: stage3-tests
    resource: ../__tests__/stage3-decorators.test.ts
    title: Tests of the decorators in both modes
  - id: vitest-config
    resource: ../vitest.config.ts
    title: Vitest configuration
---

# Purpose

The decorators describe how a class maps to XML. They do nothing at runtime except record this mapping in the metadata registry, which `marshal()` and `unmarshal()` read (see [Architecture](architecture.md#principles)). This document describes each decorator as a contract: where it goes, what it records, its options and defaults, and how the two kinds of TypeScript decorators reach the registry. How the recorded mapping is applied to XML is described in [Marshalling](marshalling.md).

# Overview

| Decorator | Goes on | Maps |
|---|---|---|
| `@XmlRoot(name?, options?)` | a class | the class to an element; used for the document's root element |
| `@XmlElement(name?, options?)` | a field | the field to child elements |
| `@XmlAttribute(name?, options?)` | a field | the field to an attribute |
| `@XmlText(options?)` | a field | the field to the text content of the element |
| `@XmlEnum(enumType)` | a field | records an enum on the field's metadata; has no effect |
| `@XmlAnyElement()` | a field | the field to all child elements that no `@XmlElement` maps |
| `@XmlAnyAttribute()` | a field | the field to all attributes that no `@XmlAttribute` maps |

All decorators are factories: they are always written with parentheses, `@XmlText()`, not `@XmlText`.

```typescript
@XmlRoot("order", { namespace: "urn:example:orders" })
class Order {
  @XmlAttribute("id")
  id?: string;

  @XmlElement("item", { type: Item, array: true })
  items: Item[] = [];

  @XmlElement("note", { type: String, nillable: true })
  note?: string | null;
}

class Item {
  @XmlAttribute("sku")
  sku?: string;

  @XmlAttribute("quantity", { type: Number })
  quantity?: number;

  @XmlText()
  description?: string;
}
```

# Common behavior

- **Names.** The XML name of an element or attribute defaults to the name of the field, and the name of the root element to the name of the class. A name is a local name, without a prefix; the namespace is a separate option.[^xmlelement]
- **Order of fields.** Each field decorator appends an entry to the class's field list, so the list follows the order in which the fields are declared.
- **Inheritance.** A class inherits the mapped fields of its base classes. `getAllFields()` collects them from the base class down to the derived class; a field that a derived class decorates again under the same field name replaces the base class's entry, also when the XML name differs.[^registry] A base class needs no `@XmlRoot`.
- **Classes without `@XmlRoot`.** Nested classes, such as `Item` above, need no `@XmlRoot`. A class used as a root also works without it as long as it has at least one decorated field: it then has metadata, and the root element's name is the class name. Only a class without any decorator fails, with the error `No XmlRoot metadata for <class>`.[^unmarshal]
- **Constructors.** `unmarshal()` creates every object with `new` and no arguments.[^unmarshal]

# @XmlRoot

```typescript
@XmlRoot(name?: string, options?: { namespace?: string; prefixes?: Record<string, string> })
```

| Option | Default | Meaning |
|---|---|---|
| `name` | the class name | the local name of the root element |
| `namespace` | none | the namespace URI of the root element; `marshal()` declares it as the default namespace |
| `prefixes` | none | preferred prefixes, as a map from namespace URI to prefix, that `marshal()` uses when it declares these namespaces |

`@XmlRoot` stores these values in the class's metadata.[^xmlroot] When `unmarshal()` looks for the root element, it compares the local name only; the namespace of the document's root is not checked (see [`unmarshal()` does not check the namespace of the root element](known-issues.md#unmarshal-does-not-check-the-namespace-of-the-root-element)).

# @XmlElement

```typescript
@XmlElement(name?: string, options?: {
  type?: unknown;
  array?: boolean;
  namespace?: string;
  nillable?: boolean;
  allowStringFallback?: boolean;
})
```

| Option | Default | Meaning |
|---|---|---|
| `name` | the field name | the local name of the child element |
| `type` | see [Field types](#field-types) | the type of the value: a class, `String`, `Number`, `Boolean`, `Date`, or a function that returns a class, such as `() => Item` |
| `array` | `false` | the element may occur several times; the field holds an array |
| `namespace` | none | the namespace URI of the element |
| `nillable` | `false` | recorded, but not used (see below) |
| `allowStringFallback` | `false` | with `Number` or `Boolean`, a value that cannot be converted stays the original string instead of becoming `NaN` or `false` |

- **Arrays.** With `array: true`, `unmarshal()` always sets an array: empty when the element is absent, with one entry for a single occurrence. An occurrence with `xsi:nil="true"` becomes `null` within the array.
- **Lazy types.** A function such as `() => Item` defers the reference to the class until it is needed, for classes that refer to each other. `resolveType()` tells a lazy reference from a class by calling it: a class throws when called without `new`, a lazy reference returns a class.[^type-resolution]
- **Namespaces.** Without `namespace`, `marshal()` writes the element without a prefix, so it is in the default namespace in scope, usually the root's. `unmarshal()` then matches the element by its local name.
- **Nil.** `unmarshal()` reads every element with `xsi:nil="true"` as `null`, and `marshal()` writes every `null` as `xsi:nil="true"`, whether or not the field is `nillable` (see [The `nillable` option has no effect](known-issues.md#the-nillable-option-has-no-effect)).[^unmarshal]

`allowStringFallback` is meant for union types such as `number | "unbounded"` or `boolean | "auto"`, as in the XSD attribute `maxOccurs`.

# @XmlAttribute

```typescript
@XmlAttribute(name?: string, options?: {
  namespace?: string;
  type?: unknown;
  allowStringFallback?: boolean;
})
```

| Option | Default | Meaning |
|---|---|---|
| `name` | the field name | the local name of the attribute |
| `namespace` | none | the namespace URI of the attribute; `marshal()` writes it with a prefix |
| `type` | see [Field types](#field-types) | `String`, `Number`, `Boolean` or `Date` |
| `allowStringFallback` | `false` | as for `@XmlElement` |

An attribute is always a single value; there is no `array` option.[^xmlattribute] Attribute values reach the field as strings unless a type converts them. With legacy decorators, an enum object as `type` makes the class definition throw (see [An enum as the `type` of `@XmlAttribute` throws](known-issues.md#an-enum-as-the-type-of-xmlattribute-throws)).

# @XmlText

```typescript
@XmlText(options?: {
  type?: unknown;
  allowStringFallback?: boolean;
})
```

| Option | Default | Meaning |
|---|---|---|
| `type` | see [Field types](#field-types) | `String`, `Number`, `Boolean` or `Date` |
| `allowStringFallback` | `false` | as for `@XmlElement` |

`@XmlText()` maps the field to the text content of the element, for elements that have attributes and text, such as `<item sku="A1">Blue pen</item>`.[^xmltext] A class has at most one such field; if there are several, only the first is used.

# @XmlEnum

`@XmlEnum(enumType)` stores `enumType` on the metadata entry of the same field. It must be applied after the decorator that creates the entry, which means it is written above it, because decorators are applied from the bottom up:

```typescript
@XmlEnum(Priority)
@XmlElement("priority")
priority?: Priority;
```

Written below `@XmlElement`, it finds no entry and records nothing.[^xmlenum] Neither `marshal()` nor `unmarshal()` reads the stored enum, so the decorator has no effect either way (see [`@XmlEnum` has no effect](known-issues.md#xmlenum-has-no-effect)). The generator does not use it.

# @XmlAnyElement and @XmlAnyAttribute

`@XmlAnyElement()` collects all child elements that no `@XmlElement` of the class maps, and `marshal()` writes them back. The field holds an array; each entry is an object with the element's qualified name as its only key and the parsed content as its value, in the form of `fast-xml-parser`: attributes are keys with the prefix `@_`, text is `#text`. For example, `<p:z q="3">c</p:z>` becomes `{ "p:z": { "#text": "c", "@_q": "3" } }`.[^wildcards]

`@XmlAnyAttribute()` collects all attributes that no `@XmlAttribute` maps into an object from qualified name to string value, for example `{ "x": "1", "p:y": "2" }`. Namespace declarations (`xmlns`, `xmlns:p`) are not included.[^wildcards]

Wildcards accept everything; they have no options to restrict the namespaces they accept, like `namespace` or `processContents` in XSD.[^types]

# Field types

How a value is converted between XML text and the field depends on the type that the field's metadata records:

1. The `type` option, if given.
2. Otherwise, with legacy decorators and `emitDecoratorMetadata`, the type that TypeScript emits for the field's declaration (`design:type`). For an array field it emits `Array` and for a union `Object`; `@XmlElement` ignores both, `@XmlAttribute` and `@XmlText` ignore `Object`.[^field-type]
3. Otherwise none. Stage 3 decorators never get a type from the declaration.

With legacy decorators, an explicit `type` that contradicts the declaration, such as `{ type: Number }` on a field declared as `string`, makes the class definition throw a `TypeError`. Stage 3 decorators cannot detect this.[^xmlattribute]

| Type | Attribute value | Element text |
|---|---|---|
| none | string | string |
| `String` | string | string |
| `Number` | `Number(value)` | `Number(value)` |
| `Boolean` | `true` for `true` and `1`, otherwise `false` | the same |
| `Date` | `new Date(value)` | `new Date(value)` |
| class | — | an object of the class |

Element text means the text of an `@XmlElement` field and of an `@XmlText()` field. The XML parser does not convert it, so `<code>007</code>` stays `"007"` in a `String` field or a field without a type.[^unmarshal] An enum object as `type` of `@XmlElement` is accepted, but treated like no type, because `resolveType()` only returns functions (see [Enum objects as `type` are ignored](known-issues.md#enum-objects-as-type-are-ignored)).[^type-resolution] [Marshalling](marshalling.md) describes the conversion in both directions.

# Legacy and Stage 3 decorators

TypeScript has two kinds of decorators: legacy decorators, with `experimentalDecorators: true`, and Stage 3 decorators, the default without that option. The library supports both and recommends legacy decorators. The TC39 proposal went back to Stage 2.7 in May 2026, no JavaScript engine ships it, and it may still change; Oxc, and with it Vite 8 and Vitest 5, does not lower Stage 3 decorators. `README.md` shows the compiler options for both.

Each decorator detects the kind from its arguments: a Stage 3 decorator receives a context object with a `kind`, a legacy field decorator receives the prototype and the field name, and a legacy class decorator the constructor.[^xmlelement]

**Legacy decorators** add the field to the registry entry of `target.constructor` when the class is defined. With `emitDecoratorMetadata`, `@XmlElement`, `@XmlAttribute` and `@XmlText` also read `design:type` through `reflect-metadata` (see [Field types](#field-types)).

**Stage 3 decorators** cannot reach the class from a field decorator, so they store the fields on the class's decorator metadata object, `context.metadata`, which the registry links to the class when it is first used. TypeScript passes `context.metadata` only when `Symbol.metadata` exists, which JavaScript engines do not provide yet; the registry therefore defines it when it is loaded, before any decorated class is defined.[^registry] Without `context.metadata`, a field registers itself through `context.addInitializer()` when the first object of the class is created; according to `README.md`, this is the case with TypeScript 5.0 and 5.1.

**One pitfall with legacy decorators:** with `emitDecoratorMetadata`, TypeScript emits a reference to the declared type of each decorated field. If that type is a class declared further down in the same file, loading the file fails with `ReferenceError: Cannot access '<class>' before initialization`. A lazy `type: () => Item` does not help, because the reference comes from the field's declaration; declare the class first or move it into a module of its own. The generated classes put each class into a module of its own.

The tests run in both modes: Vitest compiles all tests once with legacy and once with Stage 3 decorators (see [Testing](testing.md)),[^vitest-config] and `stage3-decorators.test.ts` checks that a test file was really compiled in the mode of its project and that the `addInitializer()` path registers each field once.[^stage3-tests]

## When to review

The recommendation of legacy decorators and the way the tests compile decorators are reviewed when one of these happens:

- Oxc lowers Stage 3 decorators ([oxc-project/oxc#9170](https://github.com/oxc-project/oxc/issues/9170)). Oxc could then replace the plugin that calls `ts.transpileModule`, which TypeScript 7 no longer has.
- The decorators proposal changes its stage, or a JavaScript engine ships decorators.
- TypeScript deprecates `experimentalDecorators` or changes how either kind is compiled.
- A release of TypeScript, Vite or Vitest whose changelog mentions decorators.

[#290](https://github.com/neumaennl/xmlbind-ts/issues/290) tracks the review. It is blocked by [oxc-project/oxc#9170](https://github.com/oxc-project/oxc/issues/9170), relates to the review in the editor ([neumaennl/vscode-visual-xml-schema-editor#434](https://github.com/neumaennl/vscode-visual-xml-schema-editor/issues/434)), and collects what changes in the meantime.

# Reading the metadata

The entry point exports functions to read the registry:[^registry]

| Function | Returns |
|---|---|
| `getMeta(ctor)` | the class's own metadata (`rootName`, `namespace`, `prefixes`, `fields`), or `undefined` if it has none |
| `ensureMeta(ctor)` | the same, created empty if missing |
| `getAllFields(ctor)` | the class's fields including the inherited ones, see [Common behavior](#common-behavior) |
| `allMeta()` | always an empty array (see [the known issue](known-issues.md#allmeta-always-returns-an-empty-array)) |
| `META` | the `WeakMap` from constructor to metadata |

Each field entry (`FieldMeta`) has the field name (`key`), the XML name (`name`), the kind (`element`, `attribute`, `text`, `anyElement` or `anyAttribute`), and the options of its decorator: `type`, `isArray`, `namespace`, `nillable` and `allowStringFallback`.[^types] The types themselves are not exported (see [The metadata types are not exported](known-issues.md#the-metadata-types-are-not-exported)).

[^xmlroot]: @XmlRoot

[^xmlelement]: @XmlElement

[^xmlattribute]: @XmlAttribute

[^xmltext]: @XmlText

[^field-type]: Type of a field from its declaration

[^xmlenum]: @XmlEnum

[^wildcards]: Namespace and wildcard helpers for unmarshalling

[^registry]: Metadata registry

[^types]: Metadata types

[^type-resolution]: Resolution of lazy type references

[^unmarshal]: Unmarshalling

[^stage3-tests]: Tests of the decorators in both modes

[^vitest-config]: Vitest configuration
