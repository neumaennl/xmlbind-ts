# Changelog

## Unreleased (since 2.2.0)

### Added

- Added the `xsd2ts --no-import-extensions` option to generate relative imports without `.js` extensions.

### Breaking changes

- Fields decorated with `@XmlElement(..., { array: true })` now unmarshal as arrays even when the XML contains a single occurrence. An absent element is represented as an empty array; an `xsi:nil="true"` occurrence is represented as `null` in the array, and generated property types include null for nillable values. This changes the runtime shape for single and absent occurrences.

### Changed

- Declared Node.js 24 and newer as the supported runtime range.
- Migrated the project to TypeScript 6 and run tests in both legacy and Stage 3 decorator modes.

### Maintenance

- Updated development and runtime dependencies, including ESLint, Vitest/Vite, `@types/node`, `globals`, `brace-expansion`, `fast-xml-parser`, and `source-map-js`.
- Improved CI test report generation.
