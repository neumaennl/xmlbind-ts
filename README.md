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

```bash
npm install @neumaennl/xmlbind-ts
```

### Supported Node.js versions

The library supports Node.js 24 and newer, as declared in `engines.node` of `package.json`. CI tests the latest Node.js 24 release.

`engines.node` is a declaration, not a lock: Node.js itself ignores it, and npm and pnpm only warn about an unsupported version unless `engine-strict` is set.

## Module System

This package is published as **ESM-only**.

- ESM consumers should use `import` / `export`.
- CommonJS consumers can load the package with dynamic `import()`.
- Generated classes use `.js` relative module specifiers, so TypeScript can compile them for either ESM or CommonJS consumers.

### Using from CommonJS

CommonJS consumers can still load this package via dynamic `import()`:

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

This library supports both **legacy decorators** (TypeScript's experimental decorators) and **Stage 3 decorators** (the TC39 decorators proposal). We recommend legacy decorators.

- **Legacy decorators**: Used when `experimentalDecorators: true` is set in your `tsconfig.json`
- **Stage 3 decorators**: Used when `experimentalDecorators` is not enabled (TypeScript 5.0+)

The library detects automatically which format is used. All decorators (`@XmlRoot`, `@XmlElement`, `@XmlAttribute`, etc.) work with both formats, with these differences:

- With legacy decorators and `emitDecoratorMetadata`, `@XmlElement` and `@XmlAttribute` take the type of a property from its TypeScript declaration, so `count?: number` is read as a number. Stage 3 decorators get no type information, so pass the type explicitly: `@XmlAttribute("count", { type: Number })`. Without it, attribute values stay strings, and element text that looks like a number or boolean is converted by the XML parser (so `<flag>1</flag>` becomes the number `1`, not `true`).
- The TC39 decorators proposal went back to Stage 2.7 in May 2026. No JavaScript engine ships it, and it may still change.
- Oxc, and with it Vite 8 and Vitest 5, does not lower Stage 3 decorators ([oxc-project/oxc#9170](https://github.com/oxc-project/oxc/issues/9170)). It lowers legacy decorators.

### With Legacy Decorators (experimentalDecorators, recommended)

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    // ... other options
  }
}
```

### With Stage 3 Decorators (no experimentalDecorators)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    // ... other options
    // Note: experimentalDecorators is NOT set
  }
}
```

With Stage 3 decorators, the library defines `Symbol.metadata` if the JavaScript runtime does not provide it. TypeScript 5.2 and later then pass decorator metadata to the decorators, so the fields of a class are registered when the class is defined. With TypeScript 5.0 and 5.1, they are registered when the first instance of the class is created.

## Quick Start

Here's a simple example of defining a class and marshalling/unmarshalling XML:

```typescript
import {
  XmlRoot,
  XmlElement,
  XmlAttribute,
  marshal,
  unmarshal,
} from "@neumaennl/xmlbind-ts";

@XmlRoot("Person", { namespace: "http://example.com/ns" })
class Person {
  @XmlAttribute("id")
  id!: number;

  @XmlElement("name", { type: String })
  name!: string;

  @XmlElement("age", { type: Number })
  age!: number;

  @XmlElement("alias", { type: String, array: true })
  alias!: string[];
}

// Unmarshal XML to object
const xml = `<?xml version="1.0"?>
<Person xmlns="http://example.com/ns" id="42">
  <name>John Doe</name>
  <age>30</age>
  <alias>J</alias>
  <alias>Johnny</alias>
</Person>`;

const person = unmarshal(Person, xml);
console.log(person.name); // "John Doe"
console.log(person.age); // 30
console.log(person.alias); // ["J", "Johnny"]

// Marshal object to XML
const xmlOutput = marshal(person);
console.log(xmlOutput);
```

## Decorators

### @XmlRoot

Marks a class as an XML root element.

```typescript
@XmlRoot(name?: string, options?: { namespace?: string; prefixes?: Record<string, string> })
```

**Parameters:**

- `name` (optional): The XML element name. Defaults to the class name.
- `options.namespace` (optional): The XML namespace URI.
- `options.prefixes` (optional): Map of namespace URIs to preferred prefixes

**Example:**

```typescript
@XmlRoot("Book", { namespace: "http://example.com/library" })
class Book {
  // ...
}
```

### @XmlElement

Maps a class property to an XML element.

```typescript
@XmlElement(name?: string, options?: {
  type?: any;
  array?: boolean;
  namespace?: string;
  nillable?: boolean;
})
```

**Parameters:**

- `name` (optional): The XML element name. Defaults to the property name.
- `options.type` (optional): The type constructor (String, Number, Boolean, or a custom class/enum).
- `options.array` (optional): If true, the property represents an array of elements. Unmarshalling returns an array even when the XML contains only one occurrence; if the element is absent, the property is an empty array. An `xsi:nil="true"` occurrence in an array is represented as `null` within the array.
- `options.namespace` (optional): The XML namespace for this element.
- `options.nillable` (optional): If true, allows `xsi:nil="true"` values. For generated classes, the property type includes `null` (or nullable items for arrays); manually declared properties should include `null` in the corresponding type as well.

**Example:**

```typescript
class Library {
  @XmlElement("book", { type: Book, array: true })
  books?: Book[];

  @XmlElement("description", { type: String })
  description?: string;
}
```

### @XmlAttribute

Maps a class property to an XML attribute.

```typescript
@XmlAttribute(name?: string, options?: { namespace?: string })
```

**Parameters:**

- `name` (optional): The XML attribute name. Defaults to the property name.
- `options.namespace` (optional): The XML namespace for this attribute.

**Example:**

```typescript
class Book {
  @XmlAttribute("isbn")
  isbn?: string;

  @XmlAttribute("id")
  id!: number;
}
```

### @XmlText

Maps a class property to the text content of an XML element.

```typescript
@XmlText()
```

**Example:**

```typescript
@XmlRoot("Comment")
class Comment {
  @XmlAttribute("author")
  author?: string;

  @XmlText()
  content?: string;
}

// Produces: <Comment author="John">This is a comment</Comment>
```

### @XmlAnyElement

Maps a class property to capture wildcard XML elements (xs:any).

```typescript
@XmlAnyElement()
```

This property will capture any XML child elements that are not explicitly mapped by other @XmlElement decorators. The property should be typed as `unknown[]`.

**Example:**

```typescript
@XmlRoot("FlexibleContainer")
class FlexibleContainer {
  @XmlElement("knownField", { type: String })
  knownField?: string;

  @XmlAnyElement()
  additionalElements?: unknown[];
}
```

### @XmlAnyAttribute

Maps a class property to capture wildcard XML attributes (xs:anyAttribute).

```typescript
@XmlAnyAttribute()
```

This property will capture any XML attributes that are not explicitly mapped by other @XmlAttribute decorators. The property should be typed as `{ [name: string]: string }`.

**Example:**

```typescript
@XmlRoot("FlexibleElement")
class FlexibleElement {
  @XmlAttribute("id")
  id?: string;

  @XmlAnyAttribute()
  additionalAttributes?: { [name: string]: string };
}
```

## Marshalling and Unmarshalling

### marshal

Converts a TypeScript object to an XML string.

```typescript
function marshal(obj: any): string;
```

**Example:**

```typescript
const person = new Person();
person.name = "Jane Doe";
person.age = 25;

const xml = marshal(person);
```

### unmarshal

Converts an XML string to a TypeScript object.

```typescript
function unmarshal<T>(ctor: new () => T, xml: string): T;
```

**Example:**

```typescript
const xml = "<Person><name>Jane Doe</name><age>25</age></Person>";
const person = unmarshal(Person, xml);
```

## Namespace Prefix Mappings

When unmarshalling an XML document, the prefix-to-namespace-URI mappings declared on the
root element are automatically stored on the unmarshalled object as `_namespacePrefixes`.
This lets you inspect which namespace each prefix refers to (e.g. to locate the schema that
validates a given sub-tree).

```typescript
@XmlRoot("Catalog", {
  namespace: "http://example.com/catalog",
  prefixes: { "http://example.com/ext": "ext" },
})
class Catalog {
  _namespacePrefixes?: Record<string, string>;

  @XmlElement("item", { type: String, namespace: "http://example.com/ext" })
  item?: string;
}

const xml = `<Catalog xmlns="http://example.com/catalog" xmlns:ext="http://example.com/ext">
  <ext:item>Widget</ext:item>
</Catalog>`;

const catalog = unmarshal(Catalog, xml);
console.log(catalog._namespacePrefixes);
// { "": "http://example.com/catalog", ext: "http://example.com/ext" }
```

The default namespace (the URI behind `xmlns="..."`) is stored under the empty-string key
(`""`). This preserves the source document's default namespace even when it differs from the
`@XmlRoot` decorator's `namespace` option.

### Modifying namespace prefixes before marshalling

You can modify `_namespacePrefixes` before calling `marshal`. The modified map is used as
the authoritative source for all `xmlns:prefix` declarations in the output XML.

```typescript
// Rename the "ext" prefix to "e" before serialising
catalog._namespacePrefixes = {
  "": "http://example.com/catalog",
  e: "http://example.com/ext",
};
const output = marshal(catalog);
// <Catalog xmlns="http://example.com/catalog" xmlns:e="http://example.com/ext">
//   <e:item>Widget</e:item>
// </Catalog>
```

When `_namespacePrefixes` is set (even if empty), it is the authoritative source for
namespace declarations that were present when the document was last unmarshalled. The
empty-string key represents the default namespace; omit it when the source document had no
default namespace. If you add content that uses a namespace URI not already in the map, the
marshaller will still auto-declare a generated prefix (e.g. `xmlns:ns1="..."`) for it. When
`_namespacePrefixes` is `undefined` (e.g. on a freshly constructed object), the `namespace`
and `prefixes` options from the `@XmlRoot` decorator are used as fallbacks.

### Namespace prefixes in generated code

Classes generated from top-level XSD elements automatically include a
`_namespacePrefixes` property declaration:

```typescript
@XmlRoot("Catalog", { namespace: "http://example.com/catalog" })
export class Catalog {
  _namespacePrefixes?: Record<string, string>;

  // … generated element and attribute fields
}
```

This makes the property discoverable and type-safe without requiring a cast.

## Complex Example

Here's a more complex example with nested objects:

```typescript
@XmlRoot("Address")
class Address {
  @XmlElement("street", { type: String })
  street!: string;

  @XmlElement("city", { type: String })
  city!: string;

  @XmlElement("zipCode", { type: String })
  zipCode!: string;
}

@XmlRoot("Person", { namespace: "http://example.com/ns" })
class Person {
  @XmlAttribute("id")
  id!: number;

  @XmlElement("name", { type: String })
  name!: string;

  @XmlElement("age", { type: Number })
  age?: number;

  @XmlElement("address", { type: Address })
  address?: Address;

  @XmlElement("phoneNumbers", { type: String, array: true })
  phoneNumbers?: string[];
}

const xml = `<?xml version="1.0"?>
<Person xmlns="http://example.com/ns" id="1">
  <name>John Doe</name>
  <age>30</age>
  <address>
    <street>123 Main St</street>
    <city>Springfield</city>
    <zipCode>12345</zipCode>
  </address>
  <phoneNumbers>555-1234</phoneNumbers>
  <phoneNumbers>555-5678</phoneNumbers>
</Person>`;

const person = unmarshal(Person, xml);
console.log(person.address?.city); // "Springfield"
console.log(person.phoneNumbers); // ["555-1234", "555-5678"]
```

## XSD to TypeScript Generator

The library includes a command-line tool to generate TypeScript classes from XSD schemas.

### CLI Usage

```bash
xsd2ts -i input.xsd -o output-directory [--force] [--no-delete] [--no-import-extensions]
```

By default, all relative imports and re-exports in the generated files (including the barrel `index.ts`) use `.js` extensions (e.g. `from './Person.js'`), as required by native ES modules (`"type": "module"` with `nodenext`). **Breaking change:** previously extension-less imports were written. Pass `--no-import-extensions` to get extension-less imports for projects using the older style. Programmatically, pass `false` as the third argument of `generateFromXsd`.

### Programmatic Usage

```typescript
import { generateFromXsd } from "@neumaennl/xmlbind-ts";

const xsd = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns" 
            elementFormDefault="qualified">
  <xsd:complexType name="Person">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="age" type="xsd:int"/>
    </xsd:sequence>
    <xsd:attribute name="id" type="xsd:int"/>
  </xsd:complexType>
</xsd:schema>`;

generateFromXsd(xsd, "./output");
// Generates Person.ts with appropriate decorators
```

### Supported XSD Features

The XSD generator supports a comprehensive set of XML Schema features:

#### Core Features

- **Complex Types**: Full support for named and anonymous complex types
- **Simple Types**: Enumerations, restrictions, unions, and lists
- **Elements and Attributes**: With references, namespaces, and form qualifications
- **Compositors**: `xs:sequence`, `xs:choice`, and `xs:all`
- **Content Models**: simpleContent, complexContent, mixed content

#### Advanced Features

- **Groups**: `xs:group` and `xs:attributeGroup` references with proper expansion
- **Wildcards**: `xs:any` (generates `@XmlAnyElement()`) and `xs:anyAttribute` (generates `@XmlAnyAttribute()`)
- **References**: Element and attribute references with proper namespace handling
- **Type Derivation**: Extension and restriction of complex types
- **Union Types**: Generates TypeScript union types (`string | number`)
- **List Types**: Generates TypeScript array types (`string[]`)
- **Imports**: Basic support for schema imports with namespace prefixes

#### Special Handling

- **Reserved Words**: Automatically sanitizes TypeScript reserved keywords with `_` suffix
- **Namespace Prefixes**: Automatically detects and handles namespace prefixes
- **Collision Avoidance**: Resolves naming conflicts between types and elements
- **Mixed Content**: Generates `@XmlText()` properties for elements with mixed content

### Property Requiredness in Generated Code

**Important**: The XSD generator reflects XSD requiredness in generated TypeScript properties:

- **Required elements** (default `minOccurs="1"`) generate **non-optional** properties with definite assignment assertion (`prop!: Type`)
- **Optional elements** (`minOccurs="0"`) generate **optional** properties (`prop?: Type`)
- **Required attributes** (`use="required"`) generate **non-optional** properties (`prop!: Type`)
- **Optional attributes** (default or `use="optional"`) generate **optional** properties (`prop?: Type`)
- **Elements inside xs:choice** are always optional, regardless of `minOccurs`
- **Arrays** (`maxOccurs > 1`) remain arrays; optionality is based on `minOccurs`

Example:

```xml
<xsd:complexType name="Example">
  <xsd:sequence>
    <xsd:element name="required" type="xsd:string"/>
    <xsd:element name="optional" type="xsd:string" minOccurs="0"/>
  </xsd:sequence>
  <xsd:attribute name="requiredAttr" type="xsd:string" use="required"/>
  <xsd:attribute name="optionalAttr" type="xsd:string"/>
</xsd:complexType>
```

Generates:

```typescript
export class Example {
  @XmlAttribute("requiredAttr")
  requiredAttr!: String; // Non-optional (use="required")

  @XmlAttribute("optionalAttr")
  optionalAttr?: String; // Optional (default)

  @XmlElement("required", { type: String, namespace: "..." })
  required!: String; // Non-optional (minOccurs=1 by default)

  @XmlElement("optional", { type: String, namespace: "..." })
  optional?: String; // Optional (minOccurs=0)
}
```

The definite assignment assertion (`!`) tells TypeScript that the property will be initialized by the unmarshalling framework, avoiding `strictPropertyInitialization` errors.

## Type Mapping

The library automatically handles type conversions between XML and TypeScript:

| XSD Type                           | TypeScript Type |
| ---------------------------------- | --------------- |
| xsd:string                         | String          |
| xsd:int, xsd:integer               | Number          |
| xsd:float, xsd:double, xsd:decimal | Number          |
| xsd:boolean                        | Boolean         |
| xsd:date, xsd:dateTime             | Date            |

## Enum Support

The library supports XML enumerations through XSD simpleType restrictions. When generating TypeScript from XSD, enum types are automatically created and used in the generated classes.

### Using Enums with XSD

When you have an XSD with enumeration restrictions:

```xml
<xsd:simpleType name="ColorType">
  <xsd:restriction base="xsd:string">
    <xsd:enumeration value="red"/>
    <xsd:enumeration value="green"/>
    <xsd:enumeration value="blue"/>
  </xsd:restriction>
</xsd:simpleType>

<xsd:complexType name="Product">
  <xsd:sequence>
    <xsd:element name="name" type="xsd:string"/>
    <xsd:element name="color" type="ColorType"/>
  </xsd:sequence>
</xsd:complexType>
```

The generator will create:

```typescript
// ColorType.ts
export enum ColorType {
  red = "red",
  green = "green",
  blue = "blue",
}

// Product.ts
import { ColorType } from "./ColorType";

@XmlRoot("Product")
export class Product {
  @XmlElement("name", { type: String })
  name!: String;

  @XmlElement("color", { type: ColorType })
  color!: ColorType;
}
```

### Manual Enum Usage

You can also use enums manually in your code:

```typescript
enum StatusEnum {
  pending = "pending",
  approved = "approved",
  rejected = "rejected",
}

@XmlRoot("Task")
class Task {
  @XmlElement("status", { type: String })
  status?: StatusEnum;
}

const task = new Task();
task.status = StatusEnum.approved;

const xml = marshal(task); // <Task><status>approved</status></Task>
const unmarshalled = unmarshal(Task, xml);
console.log(unmarshalled.status); // "approved"
```

### Features

- **Named enums**: Defined as top-level `xsd:simpleType` with restrictions
- **Inline enums**: Anonymous enums defined within elements
- **Enum arrays**: Support for `maxOccurs="unbounded"` with enum types
- **Special characters**: Enum values with special characters are handled (keys are sanitized, values preserved)
- **Marshalling/Unmarshalling**: Enum values are properly serialized to and from XML strings

## License

GPL-3.0-only

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Node.js version for development

Develop with the Node.js major version in `.nvmrc`, for example with `nvm install`, which installs its latest release and switches to it. nvm-windows does not read `.nvmrc`; there, run `nvm install <version>` and `nvm use <version>` with the version from the file. CI uses the latest release of that major version as well.

One Node.js major version is used everywhere, and `npm run node:check` checks that the values match:

| Value | Rule |
|---|---|
| `engines.node` | `>=` and the major version, for example `>=24`. All runtime dependencies must accept every version it includes: its first release (for example 24.0.0) and the first release of every newer line before its end of life. |
| `@types/node` | `^` and a version with the same major version, so that the types offer no API of a newer Node.js version. Dependabot ignores its major updates. |
| `.nvmrc` | The major version, for example `24`. |

`npm run node:check` also warns when the major version reaches its end of life within 90 days, and fails from the end of life on. CI runs it on every push and pull request, where a warning appears as an annotation of the run, and weekly with `--strict`, where a warning fails the run, so that GitHub sends a notification. GitHub pauses scheduled workflows of a public repository after 60 days without activity in it; re-enable the workflow in the Actions tab then.

To change the major version, run `npm run node:update` with the Node.js version from `.nvmrc`; the script is TypeScript, which Node.js runs directly from 22.18 on. It lists the runtime dependencies and the Node.js versions they accept, and a table of the Node.js release lines with their status, whether all dependencies accept them, the matching `@types/node`, the latest release and the end of life. It asks for the major version (default: the newest LTS version), writes `package.json` and `.nvmrc`, and offers to install the latest release of that major version with nvm, nvm-windows or fnm and to run `npm install`, `npm run lint` and `npm test` with it. `npm run node:update -- <major>` skips the question. Then update the version in [Supported Node.js versions](#supported-nodejs-versions) and commit the changes together.

The script reads the Node.js release schedule from GitHub, the list of Node.js releases from nodejs.org and the versions of `@types/node` from the npm registry.
