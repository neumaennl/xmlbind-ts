import { withTmpDir } from './test-utils/temp-dir';
import { readFileSync } from 'fs';
import path from 'path';
import { setupGeneratedRuntime } from './test-utils/generated-runtime';

/**
 * This test verifies that referenced top-level elements with anonymous inline types
 * are resolved to proper generated classes instead of defaulting to 'any'.
 */
describe('XSD Generator - element ref inline type resolution', () => {
  test('resolves inline complexType on referenced element', () => {
    const schema = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">\n` +
      `  <xs:element name="child">\n` +
      `    <xs:complexType>\n` +
      `      <xs:sequence>\n` +
      `        <xs:element name="doc">\n` +
      `          <xs:simpleType>\n` +
      `            <xs:restriction base="xs:string"/>\n` +
      `          </xs:simpleType>\n` +
      `        </xs:element>\n` +
      `      </xs:sequence>\n` +
      `    </xs:complexType>\n` +
      `  </xs:element>\n` +
      `  <xs:element name="container">\n` +
      `    <xs:complexType>\n` +
      `      <xs:sequence>\n` +
      `        <xs:element ref="child" minOccurs="1" maxOccurs="2"/>\n` +
      `      </xs:sequence>\n` +
      `    </xs:complexType>\n` +
      `  </xs:element>\n` +
      `</xs:schema>`;

    withTmpDir((dir) => {
      setupGeneratedRuntime(dir, [schema]);
      const containerPath = path.join(dir, 'container.ts');
      const childTypePath = path.join(dir, 'childType.ts');
      const childPath = path.join(dir, 'child.ts');
      const containerContent = readFileSync(containerPath, 'utf8');
      const childTypeContent = readFileSync(childTypePath, 'utf8');
      const childContent = readFileSync(childPath, 'utf8');

      // Underlying class exists and has no XmlRoot decorator
      expect(childTypeContent).toMatch(/export class childType/);
      expect(childTypeContent).not.toMatch(/@XmlRoot\('child'/);

      // Wrapper class has XmlRoot and extends underlying
      expect(childContent).toMatch(/@XmlRoot\('child'\)/);
      expect(childContent).toMatch(/export class child extends childType/);

      // Container references childType as array with explicit type decorator option
      expect(containerContent).toMatch(/@XmlElement\('child', \{ type: childType, array: true/);
      expect(containerContent).toMatch(/child!: childType\[];/);
    });
  });
});
