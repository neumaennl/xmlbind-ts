/**
 * @module @neumaennl/xmlbind-ts
 *
 * TypeScript XML binding library with XSD schema code generation.
 *
 * This library provides:
 * - Decorators for defining XML mappings on TypeScript classes
 * - Marshal and unmarshal functions for XML serialization
 * - XSD-to-TypeScript code generator (xsd2ts)
 *
 * @example
 * ```typescript
 * import { XmlRoot, XmlElement, XmlAttribute, marshal, unmarshal } from '@neumaennl/xmlbind-ts';
 *
 * @XmlRoot('Person')
 * class Person {
 *   @XmlAttribute('id')
 *   id!: string;
 *
 *   @XmlElement('Name')
 *   name!: string;
 * }
 *
 * const person = new Person();
 * person.id = '123';
 * person.name = 'John';
 *
 * const xml = marshal(person);
 * const obj = unmarshal(Person, xml);
 * ```
 */

export * from "./decorators";
export * from "./marshalling";
export * from "./metadata/MetadataRegistry";
export * from "./xsd/TsGenerator";
