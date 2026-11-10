# Changelog

## Unreleased (since 2.3.0)

### Fixed

- `unmarshal()` decodes character references such as `&#65;` and `&#x41;` in attribute values and element text, so `marshal()` no longer writes them back as `&amp;#65;` ([#287](https://github.com/neumaennl/xmlbind-ts/issues/287)). HTML entities that XML does not define, such as `&nbsp;`, are still not decoded.
- `marshal()` writes carriage returns as character references, so that they are read back unchanged instead of being normalized to line feeds.
- `marshal()` writes the text of comments as it is instead of escaping it, so `<!-- a & <b> -->` keeps its text. A comment that contains `--` or ends with `-`, which XML cannot represent, throws an error instead of producing a document that is not well-formed ([#292](https://github.com/neumaennl/xmlbind-ts/issues/292)).
- `marshal()` writes `null` entries of arrays as empty elements in their place instead of before the other occurrences.
- `marshal()` writes a comment after as many child elements as there were before it in the source, so comments between occurrences of the same element keep their place, and comments after more child elements than the class has element fields are written after the last element instead of being dropped ([#293](https://github.com/neumaennl/xmlbind-ts/issues/293)).

### Changed

- The `position` of a comment in `_comments` counts the child elements that are written, not the element fields, also on objects that the application creates: a comment is written after that many elements, and unset fields do not count.
- The output of `marshal()` starts with a line break unless it starts with the XML declaration, and no longer ends with one. In mixed content whose first child is an element, a line with only spaces is written before that element.
- A wildcard element with the name of a mapped element is written after the mapped elements instead of being merged with them, and a wildcard element whose key starts with `@_` or is `#text` throws an error.
- The package is compiled for ES2024 instead of ES2022, the edition that Node.js 24, the oldest supported version, fully supports. The compiler target now follows the supported Node.js version.

### Maintenance

- Added the runtime dependencies `@nodable/entities` and `is-unsafe`, which `unmarshal()` uses to decode entities and character references, and raised the minimum version of `fast-xml-parser` to 5.11.2.

## 2.3.0 (2026-10-23)

### Added

- Added the `xsd2ts --no-import-extensions` option to generate relative imports without `.js` extensions.

### Changed

- Fields decorated with `@XmlElement(..., { array: true })` now consistently unmarshal as arrays, including for a single occurrence or an absent element. This aligns the runtime value with the declared array property type; an `xsi:nil="true"` occurrence is represented as `null` within the array.
- Fixed namespace round-tripping so unmarshalled documents preserve the root's default namespace and use available prefixes when marshalling element names. This prevents changes to the meaning of unprefixed QName values, such as XSD `type` references.
- Declared Node.js 24 and newer as the supported runtime range.
- Migrated the project to TypeScript 6 and run tests in both legacy and Stage 3 decorator modes.

### Maintenance

- Updated development and runtime dependencies, including ESLint, Vitest/Vite, `@types/node`, `globals`, `brace-expansion`, `fast-xml-parser`, and `source-map-js`.
- Improved CI test report generation.
