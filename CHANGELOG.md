# Changelog

## Unreleased (since 2.3.0)

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
