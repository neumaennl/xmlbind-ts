[![CI](https://github.com/neumaennl/xmlbind-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/neumaennl/xmlbind-ts/actions/workflows/ci.yml)

# xmlbind-ts

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
  id?: number;

  @XmlElement("name", { type: String })
  name?: string;

  @XmlElement("age", { type: Number })
  age?: number;

  @XmlElement("alias", { type: String, array: true })
  alias?: string[];
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
@XmlRoot(name?: string, options?: { namespace?: string })
```

**Parameters:**

- `name` (optional): The XML element name. Defaults to the class name.
- `options.namespace` (optional): The XML namespace URI.

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
- `options.array` (optional): If true, the property represents an array of elements.
- `options.namespace` (optional): The XML namespace for this element.
- `options.nillable` (optional): If true, allows null/nil values.

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
  id?: number;
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

## Complex Example

Here's a more complex example with nested objects:

```typescript
@XmlRoot("Address")
class Address {
  @XmlElement("street", { type: String })
  street?: string;

  @XmlElement("city", { type: String })
  city?: string;

  @XmlElement("zipCode", { type: String })
  zipCode?: string;
}

@XmlRoot("Person", { namespace: "http://example.com/ns" })
class Person {
  @XmlAttribute("id")
  id?: number;

  @XmlElement("name", { type: String })
  name?: string;

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
xsd2ts input.xsd output-directory
```

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
  name?: String;

  @XmlElement("color", { type: ColorType })
  color?: ColorType;
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
