---
type: Known Issues
title: Known issues
description: Problems found in the library, the generator and the project setup that are not fixed yet, with links to GitHub issues where they exist.
tags: [known-issues, maintenance, technical-debt]
status: stable
generated: { by: human:neumaennl, at: 2026-11-11T17:42:26Z }
verified: { by: human:neumaennl, at: 2026-11-11T17:49:16Z }
sources:
  - id: registry
    resource: ../src/metadata/MetadataRegistry.ts
    title: Metadata registry
  - id: entry
    resource: ../src/index.ts
    title: Package entry point
  - id: unmarshal
    resource: ../src/marshalling/unmarshal.ts
    title: Unmarshalling
  - id: entity-decoder
    resource: ../src/marshalling/entityDecoder.ts
    title: Entity decoder of unmarshalling
  - id: escaping
    resource: ../src/marshalling/escaping.ts
    title: Escaping of marshalling
  - id: marshal
    resource: ../src/marshalling/marshal.ts
    title: Marshalling
  - id: marshal-context
    resource: ../src/marshalling/marshalContext.ts
    title: Namespace context of marshalling
  - id: xml-tree
    resource: ../src/marshalling/xmlTree.ts
    title: Ordered tree of marshalling
  - id: upstream-tests
    resource: ../__tests__/upstream-behavior.test.ts
    title: Tests of upstream behavior
  - id: element-order
    resource: ../src/marshalling/elementOrderUtils.ts
    title: Element order
  - id: comments
    resource: ../src/marshalling/commentUtils.ts
    title: Comments
  - id: classgen
    resource: ../src/xsd/tsgen/classgen.ts
    title: Generation of classes
  - id: gen-types
    resource: ../src/xsd/tsgen/types.ts
    title: Mapping of XSD types
  - id: gen-elements
    resource: ../src/xsd/tsgen/elements.ts
    title: Elements and compositors
  - id: gen-schema
    resource: ../src/xsd/tsgen/schema.ts
    title: Index of the schema
  - id: toplevel
    resource: ../src/xsd/tsgen/toplevel.ts
    title: Top-level elements
  - id: writer
    resource: ../src/xsd/tsgen/writer.ts
    title: Writer of the generated files
  - id: value-casting
    resource: ../src/util/valueCasting.ts
    title: Value casting
  - id: namespace-helpers
    resource: ../src/marshalling/namespaceHelpers.ts
    title: Namespace and wildcard helpers for unmarshalling
  - id: decorators
    resource: ../src/decorators/XmlElement.ts
    title: "@XmlElement, as an example of the decorators"
  - id: xmlattribute
    resource: ../src/decorators/XmlAttribute.ts
    title: "@XmlAttribute"
  - id: xmlenum
    resource: ../src/decorators/XmlEnum.ts
    title: "@XmlEnum"
  - id: type-resolution
    resource: ../src/util/typeResolution.ts
    title: Resolution of lazy type references
  - id: npmignore
    resource: ../.npmignore
    title: Files left out of the package
  - id: ci
    resource: ../.github/workflows/ci.yml
    title: CI workflow
  - id: eslint
    resource: ../eslint.config.mjs
    title: ESLint configuration
  - id: vitest-config
    resource: ../vitest.config.mts
    title: Vitest configuration
  - id: gen-base-attributes
    resource: ../src/xsd/tsgen/base-attribute-helpers.ts
    title: Attributes of base types
  - id: gen-restriction
    resource: ../src/xsd/tsgen/restriction-helpers.ts
    title: Attributes of restricted types
  - id: temp-dir
    resource: ../__tests__/test-utils/temp-dir.ts
    title: Temporary folders of the tests
---

# Purpose

This list collects problems that were found but not fixed, so they are not forgotten. It grows when new problems are found and shrinks when they are fixed. Not every entry needs a GitHub issue; when one is created, it is linked from the entry.

Rules:

- Each issue is a `##` heading with a short title, followed by its location, severity, effort, a description and the GitHub issue (a link, or "none").
- Within each section, entries are sorted by severity (high first), then by effort (small first).
- One cause gets one entry. An entry describes a concrete effect or a way to reproduce it, not only a suspicion.
- An entry that gets a GitHub issue keeps its entry and links the GitHub issue. Severity and effort are assessed here by the maintainer, not in the GitHub issue.
- When an issue is fixed, its entry is removed and the removal is recorded in [the log](log.md).

Severity:

- **High:** `marshal()` or `unmarshal()` silently loses or changes data, or the generator writes code that does not compile or binds the XML wrongly.
- **Medium:** a misleading result or error for valid input, missing support for XSD constructs that are common in schemas, or a mismatch between the documentation and the behavior that is likely to lead to wrong usage.
- **Low:** maintainability problems (structure, duplicated or dead code, missing checks), missing support for rare constructs or details, or minor inaccuracies.

Severity rates the problem itself, not its priority and not the problems it causes; those have entries of their own.

Effort:

- **S:** less than an hour, a local change.
- **M:** a few hours, changes in several files.
- **L:** a day or more, or design decisions are needed.

# Code

## `marshal()` writes `xsi:nil` without declaring its namespace

- **Location:** `src/marshalling/marshal.ts`
- **Severity:** High
- **Effort:** S
- **Description:** `marshal()` writes a field whose value is `null` as `<name xsi:nil="true"/>`, but declares the prefix `xsi` only if the unmarshalled source declared it. For an object created in code, the result is `<R><n xsi:nil="true"/></R>`, which is not namespace-well-formed: a namespace-aware parser rejects the unbound prefix.[^marshal]
- **GitHub issue:** none

## Leading and trailing whitespace of element text is removed

- **Location:** `src/marshalling/unmarshal.ts` (the `XMLParser` options)
- **Severity:** High
- **Effort:** S
- **Description:** The parser runs with its default `trimValues: true`, so `<b>  two  spaces  </b>` becomes `"two  spaces"`. For element text with significant whitespace, such as an `xs:string`, the value changes, and `marshal()` writes the changed value.[^unmarshal] Parsing with `trimValues: false` keeps the whitespace, but then the indentation between child elements arrives as text, which the binding of `@XmlText()` fields and mixed content would have to handle.
- **GitHub issue:** none

## `null` entries of arrays are written as empty elements

- **Location:** `src/marshalling/marshal.ts` (`valueEntries()`)
- **Severity:** High
- **Effort:** S
- **Description:** `unmarshal()` reads an occurrence with `xsi:nil="true"` in an array field as `null`, but `marshal()` does not write `null` entries of arrays as `xsi:nil="true"`. It writes them as empty elements in their place: `["x", null, "y"]` becomes `<arr>x</arr><arr/><arr>y</arr>`. A round trip of `<arr>x</arr><arr xsi:nil="true"/><arr>y</arr>` thus gives `["x", "", "y"]`: the value changes.[^marshal]
- **GitHub issue:** none

## Names with hyphens produce code that does not compile

- **Location:** `src/xsd/tsgen/classgen.ts` (`handleExtension()`), `src/xsd/tsgen/writer.ts`, `src/xsd/tsgen/toplevel.ts`
- **Severity:** High
- **Effort:** S
- **Description:** Class names are sanitized, so a complex type `my-base` becomes the class `my_base` in `my_base.ts`. But the derived class of an extension uses the unsanitized name, `export class derived extends my-base`, and the imports use it too, `import { my-base } from './my-base.js'`; a top-level element of that type imports `my-base` and extends `my_base`. TypeScript reports syntax errors.[^classgen]
- **GitHub issue:** none

## Times, durations and partial dates are mapped to `Date`

- **Location:** `src/xsd/tsgen/types.ts` (`typeMapping()`), `src/util/valueCasting.ts`
- **Severity:** High
- **Effort:** S
- **Description:** The generator maps `xs:time`, `xs:duration`, `xs:gYear`, `xs:gYearMonth`, `xs:gMonth`, `xs:gMonthDay` and `xs:gDay` to `Date`, like `xs:date` and `xs:dateTime`. `new Date()` cannot read most of their values: `10:00:00`, `P1D` and `---15` become an invalid date, which `marshal()` cannot write (`RangeError: Invalid time value`); others, such as `2026` or `--05`, become a full date and are written back as one.[^gen-types] These types need a string or a dedicated type.
- **GitHub issue:** none

## Plain comment texts are dropped when mixed with comments that have a position

- **Location:** `src/marshalling/commentUtils.ts` (`hasPositionedComments()`), `src/marshalling/marshal.ts` (`writeElements()`)
- **Severity:** High
- **Effort:** S
- **Description:** `_comments` holds either comments with a position (`{ text, position }`) or plain comment texts, which `marshal()` writes after the elements. `hasPositionedComments()` looks only at the first entry, so in an array that mixes both, the plain texts are grouped by their position, which is `undefined`, and dropped without an error: `[{ text: "a", position: 0 }, "b"]` writes only `<!--a-->`.[^marshal] `unmarshal()` never mixes them; an application that adds a plain comment to an unmarshalled object loses it.
- **GitHub issue:** none

## A restriction drops the attribute references of its base

- **Location:** `src/xsd/tsgen/base-attribute-helpers.ts` (`emitAllAttributesFiltered()`, `emitAttrsFiltered()`)
- **Severity:** High
- **Effort:** S
- **Description:** The class of a restricted complex type gets the attributes of its base, but the generator skips the attributes that the base declares with `ref`, directly or in an attribute group ("skip for now").[^gen-base-attributes] With `<xs:attribute ref="lang"/>` in the base `Base` and `<xs:restriction base="Base"/>` in `Plain`, `Base` has the property `lang` and `Plain` does not, so `unmarshal()` drops the attribute of a `Plain` element and `marshal()` cannot write it.
- **GitHub issue:** none

## Attributes of attribute groups in a restriction are generated twice

- **Location:** `src/xsd/tsgen/restriction-helpers.ts` (`collectExcludedAttributesInRestrictionChain()`)
- **Severity:** High
- **Effort:** S
- **Description:** The class of a restricted complex type gets the attributes of its base, except those that the restriction redefines. The generator recognizes a redefinition only by an attribute with a `name` directly in the restriction, not by an attribute group or an attribute `ref`.[^gen-restriction] A restriction that repeats the `<xs:attributeGroup ref="common"/>` of its base therefore gets each attribute of `common` twice, once from the base and once from the restriction, and TypeScript rejects the class with a duplicate identifier. For the same reason, `<xs:attribute ref="lang" use="prohibited"/>` would not remove `lang`; today this is hidden because attribute references of the base are dropped anyway (see [A restriction drops the attribute references of its base](#a-restriction-drops-the-attribute-references-of-its-base)).
- **GitHub issue:** none

## Namespace declarations below the root are not kept

- **Location:** `src/marshalling/unmarshal.ts`, `src/marshalling/marshal.ts`, `src/marshalling/marshalContext.ts`
- **Severity:** High
- **Effort:** M
- **Description:** `unmarshal()` stores only the namespace declarations of the root element, and `marshal()` declares all namespaces on the root. A prefix declared on a nested element is therefore lost: in mapped elements and attributes, `marshal()` replaces it with a generated prefix such as `ns1`, so QName values that use the original prefix, like `ref="q:y"`, no longer resolve; in content caught by `@XmlAnyElement()`, the element keeps its prefix but the declaration is dropped, so the output uses an undeclared prefix and is not namespace-well-formed. Reproduced with `<xs:appinfo xmlns:q="urn:q"><q:x ref="q:y"/></xs:appinfo>` and the classes generated from `XMLSchema.xsd`. For the same reason, `_namespacePrefixes` is only set and read on the root object.[^marshal-context]
- **GitHub issue:** none

## Generated classes with circular references fail to load with `emitDecoratorMetadata`

- **Location:** `src/xsd/tsgen/` (the field declarations of the generated classes)
- **Severity:** High
- **Effort:** M
- **Description:** With legacy decorators and `emitDecoratorMetadata`, the setup that `README.md` recommends, `tsc` emits a reference to the declared class of each decorated field. Generated classes that import each other in a cycle then fail when loaded as native ES modules: the classes generated from `XMLSchema.xsd` throw `ReferenceError: Cannot access 'localSimpleType' before initialization`. The lazy `type: () => X` in the decorator does not help, because the reference comes from the field's declaration. The tests do not notice, because Vitest compiles each file with `ts.transpileModule`, which emits a guarded reference, and runs the modules through its own loader. Without `emitDecoratorMetadata` the classes load.[^writer] Declaring such fields with a type that TypeScript emits as `Object` would avoid the reference.
- **GitHub issue:** none

## Dates are written as date and time in UTC

- **Location:** `src/util/valueCasting.ts` (`castValue()`, `serializePrimitive()`), `src/xsd/tsgen/types.ts`
- **Severity:** High
- **Effort:** M
- **Description:** `castValue()` reads a `Date` field, whether element, attribute or `@XmlText()` field, with `new Date(value)`, and `serializePrimitive()` writes it with `toISOString()`. The generator maps both `xs:date` and `xs:dateTime` to `Date`. An `xs:date` such as `2026-01-02` is therefore written as `2026-01-02T00:00:00.000Z`, which is not a valid `xs:date`; an `xs:dateTime` without a time zone, such as `2026-01-02T10:00:00`, is read as local time and written in UTC, `2026-01-02T09:00:00.000Z` on a machine in Central Europe, so the value depends on the machine and gets a time zone it did not have. A time zone offset in the source, such as `+02:00`, is converted to UTC as well.[^value-casting] A fix needs to know the XSD type of a field and keep the source's form, for example with a dedicated type instead of `Date`.
- **GitHub issue:** none

## List types are not supported

- **Location:** `src/xsd/tsgen/simpletypes.ts`, `src/xsd/tsgen/element-types.ts`, `src/marshalling/`
- **Severity:** High
- **Effort:** M
- **Description:** The generator declares a named `xs:list` type as an array alias, such as `type sizeList = number[]` in `types.ts`, which `README.md` lists as supported. But nothing splits the list at runtime: an attribute of a list type holds the string `"1 2 3"` although it is typed `number[]`, and an element of an anonymous list type gets the type `any`. An element of a named list type does not even compile, because the decorator refers to the type-only alias as a value: `type: () => sizeList` gives `'sizeList' only refers to a type, but is being used as a value here`.[^gen-types]
- **GitHub issue:** none

## Properties with the same name produce code that does not compile

- **Location:** `src/xsd/tsgen/elements.ts`, `src/xsd/tsgen/attributes.ts`
- **Severity:** High
- **Effort:** M
- **Description:** The generator does not check property names for duplicates. An attribute and an element with the same name, which is common, an element that occurs twice in a sequence, and names that are the same after sanitizing, such as `my-elem` and `my_elem`, all give two properties with the same name, which TypeScript rejects as a duplicate identifier.[^gen-elements] JAXB solves this with a suffix and a binding customization.
- **GitHub issue:** none

## Simple content derived from a complex type is wrong

- **Location:** `src/xsd/tsgen/classgen.ts` (`handleSimpleContent()`)
- **Severity:** High
- **Effort:** M
- **Description:** A complex type with simple content is generated as a class with an `@XmlText()` field `value` typed with the base. If the base is itself a complex type with simple content, as in `<xs:simpleContent><xs:extension base="t:money">`, the class does not extend it: it loses the base's attributes, and `value` is typed with the base's class (`value?: money`) without importing it, which does not compile.[^classgen]
- **GitHub issue:** none

## A `ref` to an element with an anonymous type uses a colliding named type

- **Location:** `src/xsd/tsgen/element-refs.ts`, `src/xsd/tsgen/toplevel.ts`
- **Severity:** High
- **Effort:** M
- **Description:** When the anonymous type of a referenced top-level element gets a suffix because its name `<element>Type` is taken, properties that refer to the element with `ref` are typed with the class that has the original name. With `XMLSchema.xsd`, `simpleType.restriction` is typed `restrictionType` instead of `restrictionType_1`, and the `any` properties of the group types are typed `anyType`, the class of `xs:anyType`, instead of `anyType_1`. The decorator `type` is wrong as well, so `unmarshal()` creates objects of the wrong class.[^toplevel]
- **GitHub issue:** [#278](https://github.com/neumaennl/xmlbind-ts/issues/278)

## Comments move when elements are reordered or dropped

- **Location:** `src/marshalling/commentUtils.ts`, `src/marshalling/marshal.ts` (`writeElements()`)
- **Severity:** High
- **Effort:** M
- **Description:** `unmarshal()` records the position of a comment as the number of child elements before it, and `marshal()` writes the comment after the same number of mapped elements, or after the last one if it writes fewer. When `marshal()` writes the elements in a different order or leaves some out, the comment keeps its count but gets other neighbours: in `<a>1</a><b>x</b><!--c--><a>2</a>`, the occurrences of `a` are written together and `c` ends up between the second `a` and `b`. Wildcard and unmapped elements count as well, but wildcard elements are written after the mapped ones and unmapped ones not at all, so a comment after them moves forward: in `<a/><u/><!--c--><b/>` with an unmapped `u`, `c` is written after `b`.[^comments] The fix belongs together with [Elements are reordered when occurrences are not contiguous](#elements-are-reordered-when-occurrences-are-not-contiguous).
- **GitHub issue:** none

## Elements are reordered when occurrences are not contiguous

- **Location:** `src/marshalling/elementOrderUtils.ts` (`sortFieldsByElementOrder()`), `src/marshalling/marshal.ts`
- **Severity:** High
- **Effort:** L
- **Description:** `unmarshal()` records the order of child elements, but `marshal()` only uses it to sort the fields: by the first occurrence of each element name, and then writes all occurrences of one field together. Occurrences separated by another element become adjacent, and wildcard elements always move behind the mapped ones: `<a>1</a><b>x</b><a>2</a>` becomes `<a>1</a><a>2</a><b>x</b>`. In an XSD, this changes the meaning of a `xs:sequence`; with the classes generated from `XMLSchema.xsd`, `element z, choice, any, element a, group` became `element z, element a, choice, any, group`.[^element-order] A fix needs an order per occurrence instead of per field name. [#252](https://github.com/neumaennl/xmlbind-ts/issues/252) states that the element order is already preserved; that holds only for contiguous runs.
- **GitHub issue:** none

## Mixed content is reordered and loses whitespace

- **Location:** `src/marshalling/unmarshal.ts`, `src/marshalling/marshal.ts`
- **Severity:** High
- **Effort:** L
- **Description:** For an element with text and child elements, the `@XmlText()` field gets all text pieces concatenated without the whitespace between them, and `marshal()` writes the child elements first and the text after them: `<M>one <i>a</i> two <i>b</i> three</M>` becomes `<M><i>a</i><i>b</i>onetwothree</M>`. In an XSD, this affects `xs:documentation` with markup, as in `Some <b>mixed</b> &amp; text`.[^unmarshal] Mixed content needs a representation that keeps text and elements in their order.
- **GitHub issue:** none

## Imported and included schemas are not read

- **Location:** `src/xsd/tsgen/schema.ts`, `src/xsd/TsGenerator.ts`
- **Severity:** High
- **Effort:** L
- **Description:** `generateFromXsd()` takes the text of one schema. `xs:import` only adds a prefix for the imported namespace; `xs:include`, `xs:redefine` and `xs:override` are ignored. A property whose type comes from an imported schema imports a file that is never generated, such as `import { thing } from './thing.js'`, which does not compile, and a top-level element of such a type gets no class. Types are also looked up by their local name only, so types with the same name in different namespaces cannot be told apart.[^gen-schema] `README.md` describes imports as having basic support.
- **GitHub issue:** none

## `allMeta()` always returns an empty array

- **Location:** `src/metadata/MetadataRegistry.ts` (`allMeta()`), exported from `src/index.ts`
- **Severity:** Medium
- **Effort:** S
- **Description:** `allMeta()` is part of the public API and its name and return type `ClassMeta[]` promise the metadata of all registered classes, but it has always returned an empty array: the registry is a `WeakMap`, which cannot be iterated. Only its TSDoc says so.[^registry] Nothing in the package or its tests uses it. The fix needs a decision: remove it (a breaking change, possibly after a deprecation), or also record the classes in a list, which keeps every decorated class reachable.
- **GitHub issue:** none

## An enum as the `type` of `@XmlAttribute` throws

- **Location:** `src/decorators/XmlAttribute.ts` (`resolveAttributeType()`)
- **Severity:** Medium
- **Effort:** S
- **Description:** With legacy decorators and `emitDecoratorMetadata`, `@XmlAttribute("a", { type: Color })` on a field `a?: Color`, where `Color` is a string enum, throws when the class is defined: `explicit type option "undefined" conflicts with the declared TypeScript type "String"`. TypeScript emits `String` as the field's type, and the check compares it with the enum object, which has no `name`. `@XmlElement` does not throw, because it resolves the type first (see [Enum objects as `type` are ignored](#enum-objects-as-type-are-ignored)).[^xmlattribute]
- **GitHub issue:** [#276](https://github.com/neumaennl/xmlbind-ts/issues/276)

## `xsi:nil` is only recognized with the prefix `xsi`

- **Location:** `src/marshalling/unmarshal.ts`
- **Severity:** Medium
- **Effort:** S
- **Description:** `unmarshal()` looks for the attribute key `xsi:nil` instead of the attribute `nil` in the namespace `http://www.w3.org/2001/XMLSchema-instance`. With another prefix, `<n i:nil="true"/>` is not read as `null`; a field with `type: String` gets the string `"[object Object]"`.[^unmarshal]
- **GitHub issue:** none

## A single-valued field gets an array for repeated elements

- **Location:** `src/marshalling/unmarshal.ts` (`bindFieldsToTarget()`, `bindRootElements()`)
- **Severity:** Medium
- **Effort:** S
- **Description:** If an element occurs more than once but its field has no `array: true`, `unmarshal()` sets an array anyway, ignoring the field's declared type. `marshal()` then writes the array with `String()`: `<b>1</b><b>2</b>` becomes `<b>1,2</b>`.[^unmarshal] The document does not match the mapping, but the result should be the first or last occurrence, or an error, not a merged value.
- **GitHub issue:** none

## The attributes of the XML declaration are not kept

- **Location:** `src/marshalling/unmarshal.ts` (`unmarshal()`), `src/marshalling/marshal.ts` (`prologEntries()`), `src/marshalling/xmlTree.ts` (`declaration()`)
- **Severity:** Medium
- **Effort:** S
- **Description:** `unmarshal()` only records whether the source starts with `<?xml`, and `marshal()` then always writes `<?xml version="1.0" encoding="UTF-8"?>`. A source with `version="1.1"` is written as XML 1.0, `standalone` is dropped, and another `encoding` is replaced by `UTF-8`, although `marshal()` returns a string that the caller may write in the source's encoding.[^marshal]
- **GitHub issue:** [#288](https://github.com/neumaennl/xmlbind-ts/issues/288)

## Infinities are not converted to and from `INF`

- **Location:** `src/util/valueCasting.ts` (`castValue()`, `serializePrimitive()`)
- **Severity:** Medium
- **Effort:** S
- **Description:** XSD writes the infinite values of `xs:float` and `xs:double` as `INF` and `-INF`. `castValue()` converts with `Number()`, which turns both into `NaN`, and `serializePrimitive()` writes `Infinity` and `-Infinity`, which no XSD type accepts. `NaN` is converted correctly in both directions.[^value-casting]
- **GitHub issue:** none

## Empty values become `0`, `false` or an invalid date

- **Location:** `src/util/valueCasting.ts` (`castValue()`, `serializePrimitive()`)
- **Severity:** Medium
- **Effort:** S
- **Description:** `castValue()` converts an empty attribute value or empty element with `Number("")`, which gives `0`, and treats it as `false` for `Boolean`; `marshal()` then writes a value that was not in the source, such as `<n>0</n>` for `<n/>`. For `Date`, `new Date("")` gives an invalid date, and `marshal()` throws `RangeError: Invalid time value` from `toISOString()`, so a document with `<d/>` cannot be written back. Empty values are not valid for these XSD types, but they occur in practice; `undefined`, or keeping the empty string, would not invent a value.[^value-casting]
- **GitHub issue:** none

## `@XmlEnum` has no effect

- **Location:** `src/decorators/XmlEnum.ts`
- **Severity:** Medium
- **Effort:** M
- **Description:** `@XmlEnum(enumType)` stores `enumType` on the field's metadata entry, and its TSDoc says that this "can be used for runtime validation and type checking", but neither `marshal()` nor `unmarshal()` reads it. It also only works when written above the decorator that creates the entry; its own TSDoc example writes it below `@XmlElement`, where it records nothing.[^xmlenum] The fix needs a decision: remove the decorator (a breaking change), or let `unmarshal()` and `marshal()` validate or convert enum values.
- **GitHub issue:** none

## A default namespace declared on a child element is ignored

- **Location:** `src/marshalling/namespaceHelpers.ts` (`matchElementKey()`, `matchAllElementKeys()`)
- **Severity:** Medium
- **Effort:** M
- **Description:** `unmarshal()` resolves the namespace of an unprefixed child element with the declarations of its parent, not with a default namespace declared on the element itself. In `<R xmlns="urn:a"><e xmlns="urn:z">3</e></R>`, the element `e` is in `urn:z`, but a field `@XmlElement("e", { namespace: "urn:a" })` reads it.[^namespace-helpers]
- **GitHub issue:** none

## Elements without a namespace are written into the default namespace

- **Location:** `src/marshalling/marshalContext.ts` (`qName()`)
- **Severity:** Medium
- **Effort:** M
- **Description:** `marshal()` writes an element field without `namespace` without a prefix and never undeclares the default namespace. Under a root with a default namespace, such an element ends up in that namespace: `<R xmlns="urn:a"><s xmlns="">plain</s></R>` becomes `<R xmlns="urn:a"><s>plain</s></R>`, where `s` is in `urn:a`. This affects unqualified local elements of schemas with `elementFormDefault="unqualified"` whose documents use a default namespace.[^marshal-context] `unmarshal()` matches such elements by local name, so the library itself does not notice, but other XML tools see a different element.
- **GitHub issue:** none

## Processing instructions, the document type and comments after the root are dropped

- **Location:** `src/marshalling/unmarshal.ts`, `src/marshalling/marshal.ts`
- **Severity:** Medium
- **Effort:** M
- **Description:** `unmarshal()` keeps neither processing instructions, nor the document type declaration, nor comments after the root element, so `marshal()` does not write them.[^comments]
- **GitHub issue:** none

## Large integers and decimals lose precision

- **Location:** `src/xsd/tsgen/types.ts` (`typeMapping()`), `src/util/valueCasting.ts`
- **Severity:** Medium
- **Effort:** M
- **Description:** `xs:long`, `xs:integer`, `xs:unsignedLong`, `xs:decimal` and the other integer types are mapped to `number`. Integers beyond 2^53 and decimals with more significant digits than a double holds change when they are read and written back, without notice.[^gen-types] JAXB maps them to `BigInteger` and `BigDecimal`; a string or `bigint` would keep the values.
- **GitHub issue:** none

## Characters that XML does not allow are written

- **Location:** `src/marshalling/xmlTree.ts`, `src/marshalling/escaping.ts`
- **Severity:** Medium
- **Effort:** M
- **Description:** XML 1.0 does not allow most control characters, such as U+0000 or U+0001, nor lone surrogates, not even as character references. `marshal()` writes them as they are in element text, attribute values and comments, because `fast-xml-builder` does not check them ([NaturalIntelligence/fast-xml-parser#902](https://github.com/NaturalIntelligence/fast-xml-parser/issues/902)), so a value that an application sets with such a character gives a document that is not well-formed.[^upstream-tests] A fix either waits for the builder or checks the values in `xmlTree.ts`. When the builder changes, the test in `__tests__/upstream-behavior.test.ts` fails; then decide whether `marshal()` needs its own check and remove the test.
- **GitHub issue:** none

## Line feeds and tabs in attribute values are not normalized

- **Location:** `src/marshalling/unmarshal.ts` (the `XMLParser` options), `src/marshalling/escaping.ts`
- **Severity:** Medium
- **Effort:** L
- **Description:** XML reads a literal line feed or tab in an attribute value as a space, and a character reference such as `&#10;` as the character itself. `fast-xml-parser` keeps literal line feeds and tabs ([NaturalIntelligence/fast-xml-parser#330](https://github.com/NaturalIntelligence/fast-xml-parser/issues/330)) and decodes the references before the value is available, so `unmarshal()` cannot tell the two apart: `a="x&#10;y"` and a literal line break both become `"x\ny"`.[^unmarshal] `marshal()` writes line feeds and tabs in attribute values as they are, so that a literal line break in the source keeps its meaning; a reference such as `&#10;` is written as a literal line feed, which other parsers read as a space.[^escaping] A fix needs the parser to normalize literal whitespace before it decodes references ([NaturalIntelligence/fast-xml-parser#920](https://github.com/NaturalIntelligence/fast-xml-parser/issues/920)), and then `marshal()` can write line feeds and tabs as references.
- **GitHub issue:** none

## Unmapped content is dropped without notice

- **Location:** `src/marshalling/unmarshal.ts`
- **Severity:** Medium
- **Effort:** L
- **Description:** Attributes and elements that no field maps are dropped unless the class has a wildcard field, and the caller cannot find out that something was dropped. With the classes generated from `XMLSchema.xsd`, an XSD 1.1 `xs:assert` and a foreign top-level element disappear on a round trip.[^unmarshal] An application that writes the document back cannot tell its users that content will be lost. A fix could collect unmapped content, report it, or both.
- **GitHub issue:** none

## Subclasses and `xsi:type` are not supported

- **Location:** `src/marshalling/marshal.ts` (`elementToXmlValue()`), `src/marshalling/unmarshal.ts`
- **Severity:** Medium
- **Effort:** L
- **Description:** `marshal()` writes a value with the fields of the field's declared type, so the fields that a subclass adds are dropped without notice. `xsi:type` is neither written nor read: `unmarshal()` always creates an object of the declared type and drops the attribute.[^marshal] XSD type substitution therefore cannot be mapped.
- **GitHub issue:** none

## Substitution groups and `abstract` are not supported

- **Location:** `src/xsd/tsgen/`
- **Severity:** Medium
- **Effort:** L
- **Description:** The generator ignores `substitutionGroup` and `abstract`. An element in a substitution group is generated as an independent top-level element, and a property for the head element accepts only the head element's name, so documents that use a member of the group lose that content on unmarshalling.[^toplevel] Together with [Subclasses and `xsi:type` are not supported](#subclasses-and-xsitype-are-not-supported), XSD's polymorphism cannot be mapped.
- **GitHub issue:** none

## `unmarshal()` does not check the namespace of the root element

- **Location:** `src/marshalling/unmarshal.ts` (`findRootNode()`)
- **Severity:** Low
- **Effort:** S
- **Description:** `unmarshal()` finds the root element by its local name only. A class with `@XmlRoot("R", { namespace: "urn:a" })` also reads `<R xmlns="urn:other">`, without an error.[^unmarshal]
- **GitHub issue:** none

## Enum objects as `type` are ignored

- **Location:** `src/util/typeResolution.ts` (`resolveType()`), `src/util/valueCasting.ts` (`castValue()`)
- **Severity:** Low
- **Effort:** S
- **Description:** `README.md` names enums as possible values of the `type` option of `@XmlElement`, and its example of generated code shows `{ type: ColorType }`. `resolveType()` returns `undefined` for anything that is not a function, and `unmarshal()` passes every type through it, so an enum object is treated like no type. The branch of `castValue()` that maps enum keys to values is therefore never reached from `unmarshal()`.[^type-resolution]
- **GitHub issue:** none

## The `nillable` option has no effect

- **Location:** `src/decorators/XmlElement.ts`, `src/marshalling/unmarshal.ts`, `src/marshalling/marshal.ts`
- **Severity:** Low
- **Effort:** S
- **Description:** `@XmlElement` records `nillable`, and `README.md` says it "allows `xsi:nil="true"` values", but neither `unmarshal()` nor `marshal()` reads it: every element with `xsi:nil="true"` becomes `null`, and every `null` is written as `xsi:nil="true"`, also for fields that are not nillable.[^unmarshal]
- **GitHub issue:** none

## The metadata types are not exported

- **Location:** `src/index.ts`, `src/types.ts`
- **Severity:** Low
- **Effort:** S
- **Description:** `getMeta()`, `ensureMeta()` and `getAllFields()` are exported and return `ClassMeta` or `FieldMeta`, but the entry point exports neither type, nor `Constructor`, which they take as a parameter.[^entry] A consumer can only name these types through `ReturnType<typeof getMeta>` and similar workarounds.
- **GitHub issue:** none

## A type named `index`, `types` or `enums` overwrites a generated file

- **Location:** `src/xsd/tsgen/writer.ts`
- **Severity:** Low
- **Effort:** S
- **Description:** Each class is written to `<Class>.ts`, and then `types.ts`, `enums.ts` and `index.ts` are written. A complex type named `index` is therefore overwritten by the barrel file, which then exports `index` from itself.[^writer]
- **GitHub issue:** none

## Top-level elements without a type get no class

- **Location:** `src/xsd/tsgen/toplevel.ts` (`processTopLevelElements()`)
- **Severity:** Low
- **Effort:** S
- **Description:** A top-level element without `type` and without an anonymous type has the type `xs:anyType`, but the generator writes no class for it, so documents with that root element cannot be unmarshalled with the generated classes.[^toplevel]
- **GitHub issue:** none

## The output of `marshal()` starts with a line break

- **Location:** `src/marshalling/xmlTree.ts` (`writeXml()`)
- **Severity:** Low
- **Effort:** S
- **Description:** In its ordered mode, `fast-xml-builder` starts the output with a line break, unless it starts with the XML declaration, and does not end it with one, while its keyed mode does the opposite ([NaturalIntelligence/fast-xml-builder#30](https://github.com/NaturalIntelligence/fast-xml-builder/issues/30)). `marshal()` returns this output as it is.[^xml-tree] When the builder changes, the first test in `__tests__/upstream-behavior.test.ts` fails; then update the exact expectations in `__tests__/xml-tree.test.ts` and `__tests__/issue-261-array-single-occurrence.test.ts`, decide whether `firstLine()` in `__tests__/test-utils/lines.ts` is still needed, and update [Marshalling](marshalling.md#output-format) and the TSDoc of `writeXml()`.
- **GitHub issue:** none

## Mixed content gets a line with only spaces

- **Location:** `src/marshalling/xmlTree.ts` (`writeXml()`)
- **Severity:** Low
- **Effort:** S
- **Description:** When an element's first child is an element and text follows, `fast-xml-builder` writes a line that contains only the indentation, which adds text to the element: `<M><i>a</i>b</M>` is written as `<M>\n  \n  <i>a</i>\n  b\n</M>` ([NaturalIntelligence/fast-xml-builder#31](https://github.com/NaturalIntelligence/fast-xml-builder/issues/31), fixed by [NaturalIntelligence/fast-xml-builder#32](https://github.com/NaturalIntelligence/fast-xml-builder/pull/32)). `unmarshal()` removes the whitespace again (see [Leading and trailing whitespace of element text is removed](#leading-and-trailing-whitespace-of-element-text-is-removed)).[^upstream-tests] When the builder changes, the second test in `__tests__/upstream-behavior.test.ts` fails; then remove it and update [Marshalling](marshalling.md#output-format) and the TSDoc of `writeXml()`.
- **GitHub issue:** none

## `findElementOccurrences()` is never called

- **Location:** `src/marshalling/elementOrderUtils.ts` (`findElementOccurrences()`)
- **Severity:** Low
- **Effort:** S
- **Description:** `findElementOccurrences()` is exported from its module but not from the package, and no code calls it; `mergeElementsByDocumentOrder()` took over its job.[^element-order] It is one of the walks through the document-order tree (see [Unmarshalling duplicates code for the root and nested elements](#unmarshalling-duplicates-code-for-the-root-and-nested-elements)) and can be removed.
- **GitHub issue:** none

## Importing the package also loads the generator

- **Location:** `src/index.ts`, `src/xsd/TsGenerator.ts`, `package.json` (`dependencies`, `exports`)
- **Severity:** Low
- **Effort:** M
- **Description:** The entry point exports `generateFromXsd()`, so importing the runtime library also loads the generator, `@xmldom/xmldom` and Node's `fs`.[^entry] For the same reason, `@xmldom/xmldom` and `commander` are runtime dependencies of every application that uses the library. Moving the generator to a subpath export, such as `@neumaennl/xmlbind-ts/xsd`, would separate them; it is a breaking change for code that imports `generateFromXsd()` from the entry point.
- **GitHub issue:** none

## Round-trip data is stored in enumerable properties

- **Location:** `src/marshalling/unmarshal.ts`, `src/marshalling/marshal.ts`
- **Severity:** Low
- **Effort:** M
- **Description:** `unmarshal()` stores what it remembers about the source in ordinary enumerable properties of the objects it creates: `_comments`, `_elementOrder`, `_namespacePrefixes`, `_documentComments` and `_hasXmlDeclaration`.[^unmarshal] They appear in `JSON.stringify()`, in `Object.keys()` and in deep-equality checks, and a decorated field with one of these names is overwritten. Non-enumerable properties or symbols as keys would avoid this; the generated classes declare `_namespacePrefixes` as a field, so they would have to change as well.
- **GitHub issue:** none

## The decorators duplicate their code

- **Location:** `src/decorators/`
- **Severity:** Low
- **Effort:** M
- **Description:** Each of the seven decorators repeats the same three branches: one for Stage 3 decorators, one for legacy decorators, and a fallback that returns another decorator function. The legacy and fallback branches build the same field entry twice. The fallback cannot be reached through decorator syntax; only tests that call the decorator functions directly reach it.[^decorators] A shared helper that detects the kind of decorator and registers a field entry would remove the duplication. Once duplicates are [detected automatically](#duplicated-code-is-not-detected-automatically), the fix also lowers the threshold of that check.
- **GitHub issue:** none

## Unmarshalling duplicates code for the root and nested elements

- **Location:** `src/marshalling/unmarshal.ts`, `src/marshalling/elementOrderUtils.ts`, `src/marshalling/commentUtils.ts`, `src/marshalling/marshal.ts`
- **Severity:** Low
- **Effort:** M
- **Description:** `unmarshal()` binds elements twice (`bindRootElements()` and `bindFieldsToTarget()`), and the walk through the document-order tree is written out five times. `marshal()` uses one code path for the root and nested elements, but `mergeChildPrefixes()` still runs only for the root's single-valued fields, which is probably accidental, and `valueEntries()` looks up the metadata of a class again for every occurrence of an element.[^unmarshal] Once duplicates are [detected automatically](#duplicated-code-is-not-detected-automatically), the fix also lowers the threshold of that check.
- **GitHub issue:** none

## Default and fixed values are ignored

- **Location:** `src/xsd/tsgen/elements.ts`, `src/xsd/tsgen/attributes.ts`
- **Severity:** Low
- **Effort:** M
- **Description:** The generator does not use `default` and `fixed` of elements and attributes. An absent attribute with `default="5"` is `undefined` after unmarshalling, not `5`.[^gen-elements] JAXB returns the default value of an absent attribute from the generated getter.
- **GitHub issue:** none

## Invalid character references are removed without an error

- **Location:** `src/marshalling/entityDecoder.ts`
- **Severity:** Low
- **Effort:** M
- **Description:** A character reference to a character that XML does not allow, such as `&#0;`, a surrogate like `&#xD800;` or a control character like `&#1;`, makes a document not well-formed, but `unmarshal()` removes it and reads the rest: `a&#0;b` becomes `"ab"`.[^entity-decoder] The decoder of `@nodable/entities` can throw only for `&#0;`; for the other characters its minimum action is to remove them, so rejecting them needs a check of its own or a change in `@nodable/entities`.
- **GitHub issue:** none

## `any` is used widely

- **Location:** most files in `src/`, in particular `src/marshalling/marshal.ts`, `src/marshalling/unmarshal.ts` and `src/decorators/`
- **Severity:** Low
- **Effort:** L
- **Description:** The [development guidelines](development-guidelines.md#typescript) ask to avoid `any`, but `src/` uses it for field metadata (although `FieldMeta` exists), for parsed XML nodes, for the `schema as any` casts around xmldom's types, in `Constructor` and in the signatures of the decorators, which serve legacy and Stage 3 decorators at once. Each of these can have a specific type: `FieldMeta`, a type for parsed nodes or `Record<string, unknown>`, xmldom's own types, `new (...args: never[]) => T`, and overloads for the two decorator forms. Since ESLint does not report `any` (`@typescript-eslint/no-explicit-any` is off), the rule could be switched on once the code is converted.[^eslint]
- **GitHub issue:** none

## `unmarshal()` parses every document twice

- **Location:** `src/marshalling/unmarshal.ts`
- **Severity:** Low
- **Effort:** L
- **Description:** `unmarshal()` parses the document once into nested objects, from which it reads the values, and once in document order with other options, from which it reads comments and the order of child elements. Parsing in document order alone would provide both, at half the parsing cost, and the values and the order would come from the same view of the document; with two parses, they differ, for example in how whitespace and numbers are treated.[^unmarshal] The binding would have to be rewritten to work on the document-order structure.
- **GitHub issue:** none

# Code size and style

## ESLint does not check the size limits

- **Location:** `eslint.config.mjs`
- **Severity:** Low
- **Effort:** S
- **Description:** The [development guidelines](development-guidelines.md#code-size) limit files to 500 lines and functions to 120, with an exception for tests, but ESLint does not check them.[^eslint] The rules `max-lines` and `max-lines-per-function` can do so. Switched on as errors, they make `npm run lint` fail until [Source files are longer than 500 lines](#source-files-are-longer-than-500-lines) and [`emitElementRef()` is longer than 120 lines](#emitelementref-is-longer-than-120-lines) are fixed, unless they start as warnings.
- **GitHub issue:** none

## `emitElementRef()` is longer than 120 lines

- **Location:** `src/xsd/tsgen/element-refs.ts` (`emitElementRef()`)
- **Severity:** Low
- **Effort:** S
- **Description:** The function has 143 lines, more than the 120 that the [development guidelines](development-guidelines.md#code-size) allow.
- **GitHub issue:** none

## Function names are longer than 30 characters

- **Location:** `src/xsd/tsgen/restriction-helpers.ts` (`collectExcludedAttributesInRestrictionChain()`), `src/marshalling/elementOrderUtils.ts` (`extractElementOrderFromPreserveOrder()`), `src/xsd/tsgen/toplevel.ts` (`processElementWithInlineSimpleType()`), `src/marshalling/commentUtils.ts` (`extractCommentsFromPreserveOrder()`)
- **Severity:** Low
- **Effort:** S
- **Description:** The [development guidelines](development-guidelines.md#typescript) set 30 characters as the upper limit for names; these four functions have between 32 and 43.
- **GitHub issue:** none

## Test files use both `test()` and `it()`

- **Location:** `__tests__/decorator-edge-cases.test.ts`, `__tests__/decorators.test.ts`, `__tests__/enums.test.ts`, `__tests__/value-casting.test.ts`, `__tests__/xsd-parser.test.ts`, `scripts/__tests__/node-releases.test.ts`, `scripts/__tests__/node-setup.test.ts`, `scripts/__tests__/node-version.test.ts`
- **Severity:** Low
- **Effort:** S
- **Description:** The [development guidelines](development-guidelines.md#tests) ask for `test()`, but these files use `it()`. Once they are converted, the rule `vitest/consistent-test-it` can enforce `test()`.
- **GitHub issue:** none

## Duplicated code is not detected automatically

- **Location:** `src/`, `scripts/`, `package.json`, `.github/workflows/ci.yml`
- **Severity:** Low
- **Effort:** S
- **Description:** The [development guidelines](development-guidelines.md#code-quality) ask to avoid duplicated code, but only reviews check this, and duplicates got through, such as [The decorators duplicate their code](#the-decorators-duplicate-their-code) and [Unmarshalling duplicates code for the root and nested elements](#unmarshalling-duplicates-code-for-the-root-and-nested-elements). The coverage report cannot find duplicates, because V8 coverage only records which code runs. A copy-paste detector such as [jscpd](https://github.com/kucherenko/jscpd) can check the code in `npm run lint` and in CI and fail the run above a threshold of duplicated lines.
- **GitHub issue:** [#295](https://github.com/neumaennl/xmlbind-ts/issues/295)

## Source files are longer than 500 lines

- **Location:** `src/marshalling/unmarshal.ts`, `scripts/lib/node-releases.ts`
- **Severity:** Low
- **Effort:** M
- **Description:** These files have more than the 500 lines that the [development guidelines](development-guidelines.md#code-size) allow.
- **GitHub issue:** none

# Tests

## Tests are not type-checked

- **Location:** `package.json` (`pretest`), `tsconfig.test.json`, `vitest.config.mts`
- **Severity:** Low
- **Effort:** S
- **Description:** Vitest compiles the tests with `ts.transpileModule`, which removes types without checking them, and `pretest` type-checks only the build and the scripts. `tsconfig.test.json` covers `src/` and `__tests__/`, but no script and no CI step runs it, so type errors in tests go unnoticed. It passes today.[^vitest-config] Adding it to `npm run typecheck` would catch them.
- **GitHub issue:** none

## Tests do not wait for `withTmpDir()`

- **Location:** `__tests__/test-utils/temp-dir.ts`, 135 calls in 21 test files
- **Severity:** Low
- **Effort:** S
- **Description:** `withTmpDir()` is asynchronous, but most tests call it without `await`.[^temp-dir] A failing assertion in the callback then does not fail its test: the test passes, and Vitest reports the error as an unhandled error of the whole run, without the test it belongs to. The tests should `await` the call; the ESLint rule `@typescript-eslint/no-floating-promises`, which needs type information, would enforce it.
- **GitHub issue:** none

## Some test files are named after issues and scatter features

- **Location:** `__tests__/issue-261-array-single-occurrence.test.ts`, `__tests__/issue-schema-unmarshal.test.ts`, `__tests__/issue-weather-schema.test.ts`, `__tests__/manual-verification-undefined-types.test.ts`, `__tests__/unmarshal-undefined-type.test.ts`, `__tests__/circular-dependency-reproduction.test.ts`, `__tests__/circular-dependencies-unmarshal.test.ts`
- **Severity:** Low
- **Effort:** M
- **Description:** The [development guidelines](development-guidelines.md#tests) ask for one feature per test file and for tests of one feature not to be scattered over several files. Several files are named after the issue or the bug they were written for instead of the feature they test, and some features are split between them: elements without a type in `unmarshal-undefined-type.test.ts` and `manual-verification-undefined-types.test.ts`, circular references in `circular-dependency-reproduction.test.ts` and `circular-dependencies-unmarshal.test.ts`. The tests would be easier to find if they were merged into the files of their feature.
- **GitHub issue:** none

## Round trips are not tested with real documents

- **Location:** `__tests__/`
- **Severity:** Low
- **Effort:** M
- **Description:** The round-trip tests check selected features with small documents written for them. No test unmarshals and marshals real-world documents and compares the result with the source, so problems that only appear in their combination are found late: the reordering of elements in an `xs:sequence`, comments that were lost, and content that no field maps, such as `xs:assert` or a processing instruction, all showed up in round trips of real schemas. A corpus could start with `XMLSchema.xsd` itself and two schemas that combine these cases, and grow with documents such as the W3C XML Schema test suite, UBL and XHTML. The test compares source and result after removing insignificant differences, such as whitespace between elements and the order of attributes; documents that fail because of a known issue are marked as expected failures until it is fixed.
- **GitHub issue:** [#294](https://github.com/neumaennl/xmlbind-ts/issues/294)

# Build and release

## The package contents are defined by a list of exclusions

- **Location:** `.npmignore`, `package.json`
- **Severity:** Medium
- **Effort:** S
- **Description:** `.npmignore` lists what to leave out, so everything else goes into the package. `npm pack --dry-run` in a checkout lists, besides `dist/`, `docs/`, `AGENTS.md`, `.github/`, `.gitattributes`, `tsconfig.build.json`, `tsconfig.test.json`, `vitest.setup.ts`, the TypeScript build information files (`*.tsbuildinfo`, also in `dist/`) and any untracked files in the checkout, such as caches and logs that `.gitignore` hides. Since a release is published from a checkout, such files can end up in a published version.[^npmignore] A `files` list in `package.json`, such as `["dist", "CHANGELOG.md"]`, would include only what is listed; npm always adds `package.json`, `README.md` and `LICENSE`.
- **GitHub issue:** none

## CI builds twice

- **Location:** `.github/workflows/ci.yml`, `package.json` (`pretest`)
- **Severity:** Low
- **Effort:** S
- **Description:** The job "Install, build and test" runs `npm run build` and then `npm test`, whose `pretest` builds again and type-checks the scripts.[^ci] Removing the build step, or running Vitest directly after an explicit type check, would avoid the second build.
- **GitHub issue:** none

[^registry]: Metadata registry

[^entry]: Package entry point

[^unmarshal]: Unmarshalling

[^marshal]: Marshalling

[^namespace-helpers]: Namespace and wildcard helpers for unmarshalling

[^decorators]: @XmlElement, as an example of the decorators

[^xmlattribute]: @XmlAttribute

[^xmlenum]: @XmlEnum

[^type-resolution]: Resolution of lazy type references

[^marshal-context]: Namespace context of marshalling

[^xml-tree]: Ordered tree of marshalling

[^upstream-tests]: Tests of upstream behavior

[^element-order]: Element order

[^comments]: Comments

[^writer]: Writer of the generated files

[^value-casting]: Value casting

[^classgen]: Generation of classes

[^gen-types]: Mapping of XSD types

[^gen-elements]: Elements and compositors

[^gen-schema]: Index of the schema

[^toplevel]: Top-level elements

[^entity-decoder]: Entity decoder of unmarshalling

[^escaping]: Escaping of marshalling

[^npmignore]: Files left out of the package

[^ci]: CI workflow

[^eslint]: ESLint configuration

[^vitest-config]: Vitest configuration

[^gen-base-attributes]: Attributes of base types

[^gen-restriction]: Attributes of restricted types

[^temp-dir]: Temporary folders of the tests
