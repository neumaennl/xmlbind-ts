# xmlbind-ts

[![CI](https://github.com/neumaennl/xmlbind-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/neumaennl/xmlbind-ts/actions/workflows/ci.yml)

JAXB-like XML binding for TypeScript.

## Overview

`xmlbind-ts` is a TypeScript library that provides JAXB-style XML data binding using decorators. It allows you to:

- Map TypeScript classes to XML documents using decorators
- Marshal (serialize) TypeScript objects to XML
- Unmarshal (deserialize) XML to TypeScript objects
- Generate TypeScript classes from XSD schemas

## Installation

The package is published to GitHub Packages, not to the npm registry. GitHub Packages needs a token even for public packages, so configure the scope `@neumaennl` once, in your user npm configuration (`~/.npmrc`) or in the `.npmrc` of your project:

```ini
@neumaennl:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` is an environment variable with a GitHub personal access token (classic) with the scope `read:packages`. Don't commit the token itself. Then install the package:

```bash
npm install @neumaennl/xmlbind-ts
```

In GitHub Actions, `actions/setup-node` writes this configuration when you pass `registry-url: https://npm.pkg.github.com` and `scope: "@neumaennl"`, and reads the token from `NODE_AUTH_TOKEN`.

### Supported Node.js versions

The library supports Node.js 24 and newer, as declared in `engines.node` of `package.json`. CI tests the latest Node.js 24 release.

`engines.node` is a declaration, not a lock: Node.js itself ignores it, and npm and pnpm only warn about an unsupported version unless `engine-strict` is set.

## Module System

This package is published as **ESM-only**.

- ESM consumers use `import` / `export`.
- CommonJS consumers can load the package with dynamic `import()`.
- Generated classes use `.js` relative module specifiers, so TypeScript can compile them for either ESM or CommonJS consumers.

### Using from CommonJS

CommonJS consumers can load this package with dynamic `import()`:

```javascript
// CommonJS file (.cjs)
async function main() {
  const { marshal, unmarshal, XmlRoot, XmlElement } = await import("@neumaennl/xmlbind-ts");
  // use API here
}

main().catch(console.error);
```

Generated classes compiled as CommonJS import this package with `require()`. This works on all [supported Node.js versions](#supported-nodejs-versions), which load ES modules with `require()` without a flag. For portable CommonJS support across other Node.js runtimes, load `xmlbind-ts` with dynamic `import()` instead.

## TypeScript Decorator Support

The library supports both **legacy decorators** (`experimentalDecorators`) and **Stage 3 decorators** (the TC39 proposal, TypeScript's default), and detects which kind is used. We recommend legacy decorators:

- The TC39 decorators proposal went back to Stage 2.7 in May 2026. No JavaScript engine ships it, and it may still change.
- Oxc, and with it Vite 8 and Vitest 5, does not lower Stage 3 decorators ([oxc-project/oxc#9170](https://github.com/oxc-project/oxc/issues/9170)). It lowers legacy decorators.
- With legacy decorators and `emitDecoratorMetadata`, `@XmlElement`, `@XmlAttribute` and `@XmlText` take the type of a field from its declaration, so `count?: number` is read as a number. Stage 3 decorators get no type information, so pass the type explicitly, as in `@XmlAttribute("count", { type: Number })`. Without it, attribute values and element text stay strings (so `<flag>1</flag>` becomes the string `"1"`, not `true`).

Legacy decorators:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Stage 3 decorators need no option; leave `experimentalDecorators` unset.

[Decorators](docs/decorators.md#legacy-and-stage-3-decorators) describes the differences in detail.

## Quick Start

```typescript
import { XmlRoot, XmlElement, XmlAttribute, marshal, unmarshal } from "@neumaennl/xmlbind-ts";

@XmlRoot("person", { namespace: "urn:example:people" })
class Person {
  @XmlAttribute("id")
  id?: string;

  @XmlElement("name", { type: String })
  name?: string;

  @XmlElement("age", { type: Number })
  age?: number;

  @XmlElement("alias", { type: String, array: true })
  aliases: string[] = [];
}

const person = unmarshal(Person, `<person xmlns="urn:example:people" id="42">
  <name>Jane Doe</name>
  <age>30</age>
  <alias>JD</alias>
</person>`);

console.log(person.name);    // "Jane Doe"
console.log(person.age);     // 30
console.log(person.aliases); // ["JD"]

person.aliases.push("Janie");
console.log(marshal(person));
// <person xmlns="urn:example:people" id="42">
//   <name>Jane Doe</name>
//   <age>30</age>
//   <alias>JD</alias>
//   <alias>Janie</alias>
// </person>
```

The example works with legacy and Stage 3 decorators, because it passes the types of the elements explicitly. [Decorators](docs/decorators.md) describes all decorators and their options, and [Marshalling](docs/marshalling.md) how `unmarshal()` and `marshal()` work.

## Generating Classes from an XSD

```bash
npx xsd2ts -i library.xsd -o src/generated
```

`xsd2ts` writes one class per complex type and top-level element, plus `enums.ts`, `types.ts` and a barrel file `index.ts`. **It first deletes all `.ts` files in the output folder**, after asking for confirmation unless you pass `--force`; use a folder that contains only generated files. For this schema:

```xml
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="urn:example:library" elementFormDefault="qualified">
  <xs:element name="library">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="book" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="title" type="xs:string"/>
            </xs:sequence>
            <xs:attribute name="isbn" type="xs:string" use="required"/>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
```

the generated classes are used like hand-written ones:

```typescript
import { unmarshal } from "@neumaennl/xmlbind-ts";
import { library } from "./generated/index.js";

const lib = unmarshal(library, `<library xmlns="urn:example:library">
  <book isbn="978-0261103344"><title>The Hobbit</title></book>
</library>`);
console.log(lib.book[0].title); // "The Hobbit"
```

The same generation is available as `generateFromXsd(xsdText, outDir)`. [Code generation](docs/code-generation.md) describes the options, how XSD constructs map to TypeScript, and what the generator does not support yet; notably, it reads a single schema file and does not follow `xs:import` or `xs:include`.

## Limitations

`xmlbind-ts` aims at JAXB's functionality, but is not there yet. The most important gaps today:

- A round trip with `marshal(unmarshal(…))` does not keep everything: elements whose occurrences are not contiguous are reordered, mixed content is reordered, unmapped content, processing instructions and namespace declarations below the root are dropped, and the formatting is normalized ([#252](https://github.com/neumaennl/xmlbind-ts/issues/252)).
- The generator does not read imported or included schemas, and some schemas produce code that does not compile, for example with hyphens in type names or with an attribute and an element of the same name.

[Marshalling](docs/marshalling.md#what-a-round-trip-keeps-and-changes) lists what a round trip keeps and changes, and [Known issues](docs/known-issues.md) all known problems.

## Documentation

The documentation is in [`docs/`](docs/index.md):

- [Architecture](docs/architecture.md): the runtime library and the generator, the public API and the dependencies
- [Decorators](docs/decorators.md): the decorators, their options, and legacy versus Stage 3 decorators
- [Marshalling](docs/marshalling.md): `unmarshal()` and `marshal()`, namespaces, order, comments and round trips
- [Code generation](docs/code-generation.md): `xsd2ts` and the mapping of XSD to TypeScript
- [Known issues](docs/known-issues.md): problems that are not fixed yet

The [changelog](CHANGELOG.md) lists the changes of each version.

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) describes the development setup, the checks and how pull requests are reviewed.

## License

GPL-3.0-only
