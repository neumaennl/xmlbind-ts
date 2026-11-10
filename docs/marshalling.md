---
type: Reference
title: Marshalling
description: How unmarshal() turns an XML string into objects and marshal() turns them back - binding of attributes, elements, text and wildcards, value conversion, namespaces and prefixes, comments and order, the output format, and what a round trip keeps and changes.
tags: [marshal, unmarshal, namespaces, round-trip, value-casting, public-api]
status: stable
generated: { by: human:neumaennl, at: 2026-11-10T14:47:10Z }
verified: { by: human:neumaennl, at: 2026-11-10T15:31:36Z }
sources:
  - id: unmarshal
    resource: ../src/marshalling/unmarshal.ts
    title: Unmarshalling
  - id: marshal
    resource: ../src/marshalling/marshal.ts
    title: Marshalling
  - id: marshal-context
    resource: ../src/marshalling/marshalContext.ts
    title: Namespace context of marshalling
  - id: namespace-helpers
    resource: ../src/marshalling/namespaceHelpers.ts
    title: Namespace and wildcard helpers for unmarshalling
  - id: element-order
    resource: ../src/marshalling/elementOrderUtils.ts
    title: Element order
  - id: comments
    resource: ../src/marshalling/commentUtils.ts
    title: Comments
  - id: value-casting
    resource: ../src/util/valueCasting.ts
    title: Value casting
  - id: entity-decoder
    resource: ../src/marshalling/entityDecoder.ts
    title: Entity decoder of unmarshalling
  - id: escaping
    resource: ../src/marshalling/escaping.ts
    title: Escaping of marshalling
  - id: source-namespaces-test
    resource: ../__tests__/marshal-preserves-source-namespaces.test.ts
    title: Tests of the namespaces kept from the source
---

# Purpose

`unmarshal()` creates objects from an XML string, and `marshal()` writes objects as an XML string, using the mapping that the [decorators](decorators.md) record. This document describes what both functions do, in which order and with which limits, and what a document loses or changes when it is unmarshalled and marshalled again. The statements about round trips were checked with hand-written classes and with the classes that `xsd2ts` generates from the XSD schema for schemas, `__tests__/test-resources/XMLSchema.xsd`.

# The functions

```typescript
function unmarshal<T>(cls: new () => T, xml: string): T;
function marshal(obj: any): string;
```

Both work synchronously on complete strings. `unmarshal()` throws if the class has no metadata (`No XmlRoot metadata for <class>`) or if the document has no root element with the expected name (`Root element <name> not found`). `marshal()` throws for an object whose class has no metadata, and returns an empty string for `null` or `undefined`.[^unmarshal]

```typescript
const order = unmarshal(Order, `<order xmlns="urn:example:orders" id="42">
  <item sku="A1" quantity="2">Blue pen</item>
</order>`);
order.items[0].quantity; // 2
order.items[0].description; // "Blue pen"

order.items[0].quantity = 3;
marshal(order);
// <order xmlns="urn:example:orders" id="42">
//   <item sku="A1" quantity="3">Blue pen</item>
// </order>
```

`Order` and `Item` are the classes from the example in [Decorators](decorators.md#overview).

# Unmarshalling

`unmarshal()` parses the document twice with `fast-xml-parser`: once into nested objects, from which it reads the values, and once in document order, from which it reads comments and the order of child elements.[^unmarshal] One parse in document order would provide both (see [Known issues](known-issues.md#unmarshal-parses-every-document-twice)). It then:

1. finds the root element by its local name, `@XmlRoot`'s `name` or the class name; the namespace of the root is not checked (see [Known issues](known-issues.md#unmarshal-does-not-check-the-namespace-of-the-root-element));
2. creates an object of the class with `new` and no arguments and sets every array field to an empty array;
3. binds the attributes, elements, wildcards and text of the element to the fields, creating nested objects for fields whose type is a class, recursively;
4. stores what it remembers about the source on the objects (see [What unmarshalled objects remember](#what-unmarshalled-objects-remember)).

## Binding

- **Attributes.** An attribute field without `namespace` matches the unprefixed attribute with its name. With `namespace`, it matches a prefixed attribute whose prefix is declared for that URI; the default namespace never applies to attributes.[^namespace-helpers]
- **Elements.** An element field without `namespace` matches child elements by local name, with or without prefix; if both occur, the unprefixed ones win, and elements with the same local name in another namespace are not mixed in. With `namespace`, a child element matches if its prefix, or the default namespace for an unprefixed element, resolves to that URI. Prefixes are resolved with the declarations of the parent and its ancestors; a default namespace declared on the child element itself is ignored (see [Known issues](known-issues.md#a-default-namespace-declared-on-a-child-element-is-ignored)).[^namespace-helpers]
- **Several occurrences.** A field with `array: true` gets all occurrences in document order, an empty array if there is none. A field without `array: true` gets the value of a single occurrence; if the element occurs more than once, it gets an array anyway (see [Known issues](known-issues.md#a-single-valued-field-gets-an-array-for-repeated-elements)).[^unmarshal]
- **Nil.** An occurrence with `xsi:nil="true"` becomes `null`, also within arrays. Only the literal prefix `xsi` is recognized (see [Known issues](known-issues.md#xsinil-is-only-recognized-with-the-prefix-xsi)).
- **Nested objects.** For a field whose type is a class, `unmarshal()` creates an object of that class and binds it in the same way. A field without a type gets the parser's raw value: a string, number or boolean for an element with only text, otherwise an object in the parser's form, with attributes as keys with the prefix `@_` and text as `#text`.
- **Text.** The `@XmlText()` field gets the element's text. In mixed content, all text pieces are concatenated without the whitespace between them (see [Known issues](known-issues.md#mixed-content-is-reordered-and-loses-whitespace)).
- **Wildcards.** `@XmlAnyAttribute()` gets all attributes that no attribute field matched, except namespace declarations; `@XmlAnyElement()` gets all child elements that no element field matched (see [Decorators](decorators.md#xmlanyelement-and-xmlanyattribute) for their form).
- **Unmapped content.** Without a wildcard field, attributes and elements that no field matches are dropped without notice (see [Known issues](known-issues.md#unmapped-content-is-dropped-without-notice)).

## Value conversion

Attribute values arrive as strings, with literal line feeds and tabs kept instead of being turned into spaces as XML requires (see [Known issues](known-issues.md#line-feeds-and-tabs-in-attribute-values-are-not-normalized)). Element text is converted by the parser first: text that looks like a number becomes a number, `true` and `false` become booleans, and leading and trailing whitespace is removed.[^unmarshal] Then the field's type converts the value with `castValue()`:[^value-casting]

| Type | Conversion |
|---|---|
| none | the value stays as the parser delivered it |
| `String` | `String(value)` |
| `Number` | `Number(value)`; with `allowStringFallback`, a value that gives `NaN` stays the original string. `NaN` is read correctly, but XSD's `INF` and `-INF` become `NaN` |
| `Boolean` | `true` for `true` and `1`, `false` for anything else; with `allowStringFallback`, values other than `true`, `1`, `false` and `0` stay strings |
| `Date` | `new Date(value)`; a date and time without a time zone is read as local time |

An empty attribute value or empty element becomes `0` for `Number`, `false` for `Boolean` and an invalid date for `Date`, which `marshal()` then cannot write (see [Known issues](known-issues.md#empty-values-become-0-false-or-an-invalid-date)).

Because the parser converts first, a type cannot undo the conversion: `<code>007</code>` becomes `"7"` even with `type: String` ([#275](https://github.com/neumaennl/xmlbind-ts/issues/275)). The parser decodes the five predefined entities, character references such as `&#65;` and `&#x41;`, and the entities a DOCTYPE declares, except those whose value is unsafe in HTML or XML, such as markup with a `<script>` element. HTML entities that XML does not define, such as `&nbsp;`, stay as they are, and references to characters that XML does not allow, such as `&#0;`, are removed without an error (see [Known issues](known-issues.md#invalid-character-references-are-removed-without-an-error)).[^entity-decoder] CDATA sections are read as ordinary text.

# Marshalling

`marshal()` builds the element tree from the object's fields and writes it with `fast-xml-builder`.[^marshal]

- **Which fields.** Fields whose value is `undefined` are left out. A `null` element value is written as `xsi:nil="true"`. A `null` attribute value is left out, because XML has no nil for attributes. An empty string is written as an empty element, `<name/>`, which XML treats like `<name></name>`.
- **`null` in arrays.** A `null` entry of an array is not written as `xsi:nil="true"` but as an empty element, and it moves to the front: `["x", null]` becomes `<arr/><arr>x</arr>` (see [Known issues](known-issues.md#null-entries-of-arrays-are-written-as-empty-elements-at-the-front)).
- **Values.** Booleans are written as `true` and `false`, and everything else except dates with `String()`.[^value-casting] Special characters are escaped (`&lt;`, `&amp;` and so on), and a carriage return is written as `&#13;`, because a parser would otherwise turn it into a line feed. Line feeds and tabs in attribute values are written as they are, which a parser reads as spaces (see [Known issues](known-issues.md#line-feeds-and-tabs-in-attribute-values-are-not-normalized)). The text of comments is escaped as well, which changes it (see [Known issues](known-issues.md#comments-are-escaped-and-not-checked)).[^escaping]
- **Special numbers.** `NaN` is written as `NaN`, which the XSD types `xs:float` and `xs:double` accept and the other numeric types reject. The infinities are written as `Infinity` and `-Infinity`, which no XSD type accepts; XSD writes them as `INF` and `-INF` (see [Known issues](known-issues.md#infinities-are-not-converted-to-and-from-inf)).
- **Dates.** A `Date` is written with `toISOString()`, always as a date and time in UTC, such as `2026-01-02T00:00:00.000Z`. An `xs:date` therefore becomes a date and time, and a time without a time zone gets one (see [Known issues](known-issues.md#dates-are-written-as-date-and-time-in-utc)).
- **Nested objects.** A value is written with the fields of the type that the field declares, not those of the value's own class: the fields that a subclass adds are left out, and `xsi:type` is neither written nor read (see [Known issues](known-issues.md#subclasses-and-xsitype-are-not-supported)). A plain object with the right properties works as well as an instance.
- **Order.** Attributes come first, in the order of the fields, followed by the wildcard attributes. Then come the element fields, followed by the wildcard elements and the text. The elements are written field by field, all occurrences of one field together. Unmarshalled objects sort the fields by the first occurrence of their element in the source (see [Order and comments](#order-and-comments)); other objects use the order in which the fields are declared.

## Output format

The output is indented by two spaces, with one element per line, attribute values in double quotes, and empty elements written as `<name/>`. The format is fixed; keeping the format of the source is planned in [#252](https://github.com/neumaennl/xmlbind-ts/issues/252).[^marshal]

The output starts with `<?xml version="1.0" encoding="UTF-8"?>` only if the unmarshalled source had an XML declaration. The declaration's own `version`, `encoding` and `standalone` are not kept (see [Known issues](known-issues.md#the-attributes-of-the-xml-declaration-are-not-kept)).

# Namespaces and prefixes

`marshal()` declares all namespaces on the root element. It takes the declarations from these sources, in this order:[^marshal]

1. **`_namespacePrefixes` of the root object.** This is a map from prefix to URI, with the default namespace under the key `""`. `unmarshal()` sets it from the declarations on the source's root element. If it is set, it is the complete list of declarations for the namespaces it contains, and `@XmlRoot`'s `namespace` and `prefixes` are ignored.
2. **`@XmlRoot`, if `_namespacePrefixes` is not set.** Its `namespace` is declared as the default namespace, and its `prefixes`, a map from URI to prefix, as prefixed declarations. The `prefixes` of the classes of the root's single-valued element fields are added as well.
3. **Generated prefixes.** Every other namespace that a field needs gets a generated prefix: `ns1`, `ns2` and so on.[^marshal-context]

`_namespacePrefixes` can be changed before marshalling, for example to rename a prefix; the generated classes of top-level elements declare it as a field. `unmarshal()` sets it only on the root object, and `marshal()` reads it only there, because declarations below the root are not kept (see below).

When writing names, an element in the default namespace gets no prefix, any other namespace its prefix. An element field without `namespace` is written without a prefix, so it ends up in whatever default namespace is in scope, which changes its namespace if it had none in the source (see [Known issues](known-issues.md#elements-without-a-namespace-are-written-into-the-default-namespace)). Attributes with a namespace always get a prefix.[^marshal-context]

Namespace declarations on elements below the root are not kept: a prefix declared there is replaced by a generated one in mapped elements, and dropped in wildcard content, which then uses an undeclared prefix (see [Known issues](known-issues.md#namespace-declarations-below-the-root-are-not-kept)). The prefixes and the default namespace of the root are kept, so QName values that use them, such as `type="xs:string"` in an XSD, keep their meaning.[^source-namespaces-test]

# Order and comments

`unmarshal()` stores on each object the local names of its child elements in document order (`_elementOrder`) and its comments with their position (`_comments`). On the root object, it also stores the comments before the root element (`_documentComments`) and whether there was an XML declaration (`_hasXmlDeclaration`).[^element-order]

`marshal()` sorts the element fields by the position of the first occurrence of their element in `_elementOrder`, and puts fields that do not occur after them in their declared order. This keeps the order of a document in which each element name occurs in one contiguous run. If occurrences of one name are separated by another element, as in `<a/><b/><a/>`, they are written together, as `<a/><a/><b/>`; wildcard elements always move behind the mapped ones (see [Known issues](known-issues.md#elements-are-reordered-when-occurrences-are-not-contiguous)).[^element-order]

A comment's position counts the child elements before it, but `marshal()` inserts comments between fields, so a comment between two occurrences of the same element, or after a repeated element, moves (see [Known issues](known-issues.md#comments-between-repeated-elements-move)). Comments before the root element are written before it; comments after the root element are dropped.[^comments]

# What unmarshalled objects remember

The information that `unmarshal()` stores for the round trip is kept in ordinary properties of the objects:[^unmarshal]

| Property | Set on | Content |
|---|---|---|
| `_namespacePrefixes` | the root object | the namespace declarations of the root element |
| `_hasXmlDeclaration` | the root object | `true` if the source started with `<?xml` |
| `_documentComments` | the root object | the comments before the root element |
| `_elementOrder` | every object | the local names of the child elements in document order |
| `_comments` | every object | the comments among the child elements, with their position |

They are enumerable, so they appear in `JSON.stringify()` and in deep-equality checks (see [Known issues](known-issues.md#round-trip-data-is-stored-in-enumerable-properties)).

# What a round trip keeps and changes

`marshal(unmarshal(cls, xml))` keeps:

- the values of all mapped attributes and elements, within the limits of [Value conversion](#value-conversion);
- the order of the child elements, if each element name occurs in one contiguous run;
- comments among the child elements and before the root element, at the positions described in [Order and comments](#order-and-comments);
- the prefixes and the default namespace declared on the root element, and with them the meaning of QName values that use them;
- attributes and elements caught by wildcard fields, with their prefixes.[^source-namespaces-test]

It changes:

- **Values:** element text that looks like a number ([#275](https://github.com/neumaennl/xmlbind-ts/issues/275)), leading and trailing whitespace of element text, mixed content, dates and times in `Date` fields, `INF` and `-INF` in `Number` fields, empty values in `Number`, `Boolean` and `Date` fields, `xsi:nil` occurrences in arrays, the references `&#10;` and `&#9;` in attribute values, which are written as literal characters, and comments with special characters.
- **Structure:** the order of elements that are not contiguous, the position of some comments, and the namespace of elements that had no namespace under a default namespace.
- **Lost content:** unmapped attributes and elements, processing instructions, the document type declaration, comments after the root element, namespace declarations below the root, and the attributes of the XML declaration.
- **Format:** indentation, line breaks, quotes, the order of attributes, character references, which are written as the characters they stand for, except those that are escaped as described in [Marshalling](#marshalling), and CDATA sections, which become escaped text ([#252](https://github.com/neumaennl/xmlbind-ts/issues/252)).

The problems in this list that change values, structure or content are described in [Known issues](known-issues.md).

[^unmarshal]: Unmarshalling

[^marshal]: Marshalling

[^marshal-context]: Namespace context of marshalling

[^namespace-helpers]: Namespace and wildcard helpers for unmarshalling

[^element-order]: Element order

[^comments]: Comments

[^value-casting]: Value casting

[^entity-decoder]: Entity decoder of unmarshalling

[^escaping]: Escaping of marshalling

[^source-namespaces-test]: Tests of the namespaces kept from the source
