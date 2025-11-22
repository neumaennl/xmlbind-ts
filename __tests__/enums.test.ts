import {
  XmlRoot,
  XmlElement,
  XmlAttribute,
  XmlText,
  XmlEnum,
} from "../src/decorators";
import { marshal, unmarshal } from "../src/marshalling";
import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";

import path from "path";
import { withTmpDir, expectStringsOnConsecutiveLines, expectStringsOnSameLine } from "./test-utils";

// Define test enums
enum StatusEnum {
  pending = "pending",
  approved = "approved",
  rejected = "rejected",
}

enum PriorityEnum {
  low = "low",
  medium = "medium",
  high = "high",
}

enum NumericEnum {
  First = 1,
  Second = 2,
  Third = 3,
}

@XmlRoot("Task", { namespace: "http://example.com/task" })
class Task {
  @XmlAttribute("id")
  id?: number;

  @XmlElement("title", { type: String })
  title?: string;

  @XmlElement("status", { type: String })
  status?: StatusEnum;

  @XmlElement("priority", { type: String })
  priority?: PriorityEnum;

  @XmlElement("tags", { type: String, array: true })
  tags?: string[];
}

@XmlRoot("Config")
class Config {
  @XmlText()
  value?: StatusEnum;
}

@XmlRoot("enumTask")
class EnumTask {
  @XmlEnum(StatusEnum)
  @XmlElement("status", { type: String })
  status?: StatusEnum;
}

@XmlRoot("itemWithPriority")
class ItemWithPriority {
  @XmlEnum(PriorityEnum)
  @XmlAttribute("priority")
  priority?: PriorityEnum;
}

@XmlRoot("numericData")
class NumericData {
  @XmlEnum(NumericEnum)
  @XmlElement("value", { type: Number })
  value?: NumericEnum;
}

@XmlRoot("multiEnum")
class MultiEnum {
  @XmlEnum(StatusEnum)
  @XmlElement("status", { type: String })
  status?: StatusEnum;

  @XmlEnum(PriorityEnum)
  @XmlAttribute("priority")
  priority?: PriorityEnum;
}

describe("Enums", () => {

  describe("Marshalling with enums", () => {
    test("marshal object with enum values to XML", () => {
      const task = new Task();
      task.id = 2;
      task.title = "Fix bug";
      task.status = StatusEnum.approved;
      task.priority = PriorityEnum.medium;
      task.tags = ["bugfix", "backend"];

      const xml = marshal(task);

      // Verify attribute is on the opening tag line
      const firstLine = xml.split('\n')[0];
      expectStringsOnSameLine(firstLine, ['<Task', 'id="2"']);
      
      // Verify elements appear on consecutive lines
      expectStringsOnConsecutiveLines(xml, [
        "<title>Fix bug</title>",
        "<status>approved</status>",
        "<priority>medium</priority>",
        "<tags>bugfix</tags>",
        "<tags>backend</tags>",
      ]);
    });

    it("should marshal enum values correctly with XmlEnum decorator", () => {
      const task = new EnumTask();
      task.status = StatusEnum.approved;

      const xml = marshal(task);
      expect(xml).toContain("<status>approved</status>");
    });

    it("should marshal attribute enums correctly", () => {
      const item = new ItemWithPriority();
      item.priority = PriorityEnum.high;

      const xml = marshal(item);
      expect(xml).toContain('priority="high"');
    });

    it("should marshal numeric enums correctly", () => {
      const data = new NumericData();
      data.value = NumericEnum.Second;

      const xml = marshal(data);
      expect(xml).toContain("<value>2</value>");
    });

    test("marshal enum as text content", () => {
      const config = new Config();
      config.value = StatusEnum.pending;

      const xml = marshal(config);

      expect(xml).toContain("<Config>pending</Config>");
    });

    test("preserve enum type through marshalling", () => {
      const task = new Task();
      task.title = "Test task";
      task.status = StatusEnum.approved;

      const xml = marshal(task);

      expect(xml).toContain("<status>approved</status>");

      const unmarshalled = unmarshal(Task, xml);
      expect(unmarshalled.status).toBe(StatusEnum.approved);
      expect(unmarshalled.status).toBe("approved");
    });
  });

  describe("Unmarshalling with enums", () => {
    test("unmarshal XML with enum values", () => {
      const xml = `<?xml version="1.0"?>
<Task xmlns="http://example.com/task" id="1">
  <title>Review PR</title>
  <status>pending</status>
  <priority>high</priority>
  <tags>code-review</tags>
  <tags>urgent</tags>
</Task>`;

      const task = unmarshal(Task, xml);

      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe("1");
      expect(task.title).toBe("Review PR");
      expect(task.status).toBe("pending");
      expect(task.priority).toBe("high");
      expect(task.tags).toEqual(["code-review", "urgent"]);
    });

    it("should unmarshal enum values correctly with XmlEnum decorator", () => {
      const xml = `<enumTask><status>inactive</status></enumTask>`;
      const task = unmarshal(EnumTask, xml);

      expect(task.status).toBe("inactive");
    });

    it("should unmarshal attribute enums correctly", () => {
      const xml = `<itemWithPriority priority="medium" />`;
      const item = unmarshal(ItemWithPriority, xml);

      expect(item.priority).toBe("medium");
    });

    it("should unmarshal numeric enums correctly", () => {
      const xml = `<numericData><value>3</value></numericData>`;
      const data = unmarshal(NumericData, xml);

      expect(data.value).toBe(3);
    });

    test("unmarshal enum as text content", () => {
      const xml = `<?xml version="1.0"?>
<Config>approved</Config>`;

      const config = unmarshal(Config, xml);

      expect(config).toBeInstanceOf(Config);
      expect(config.value).toBe("approved");
    });

    it("should handle missing enum values gracefully", () => {
      const xml = `<enumTask><status></status></enumTask>`;
      const task = unmarshal(EnumTask, xml);

      expect(task.status).toBe("");
    });
  });

  describe("Roundtrip with enums", () => {
    test("roundtrip with enum values", () => {
      const task = new Task();
      task.id = 3;
      task.title = "Deploy";
      task.status = StatusEnum.rejected;
      task.priority = PriorityEnum.low;

      const xml = marshal(task);
      const unmarshalled = unmarshal(Task, xml);

      expect(unmarshalled.id).toBe("3");
      expect(unmarshalled.title).toBe(task.title);
      expect(unmarshalled.status).toBe("rejected");
      expect(unmarshalled.priority).toBe("low");
    });

    test("handle all enum values", () => {
      const statusValues = [
        StatusEnum.pending,
        StatusEnum.approved,
        StatusEnum.rejected,
      ];

      for (const status of statusValues) {
        const task = new Task();
        task.title = "Test";
        task.status = status;

        const xml = marshal(task);
        const unmarshalled = unmarshal(Task, xml);

        expect(unmarshalled.status).toBe(status);
      }
    });

    it("should marshal and unmarshal multiple enums", () => {
      const task = new MultiEnum();
      task.status = StatusEnum.pending;
      task.priority = PriorityEnum.low;

      const xml = marshal(task);
      expect(xml).toContain("<status>pending</status>");
      expect(xml).toContain('priority="low"');

      const unmarshalled = unmarshal(MultiEnum, xml);
      expect(unmarshalled.status).toBe("pending");
      expect(unmarshalled.priority).toBe("low");
    });
  });

  describe("XSD generation with enums", () => {
    test("generates enum from named simpleType with restrictions", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
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
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        // Enums are now in consolidated enums.ts file
        const enumsFile = path.join(tmp, "enums.ts");
        const enumsContent = readFileSync(enumsFile, "utf8");
        expectStringsOnConsecutiveLines(enumsContent, [
          "export enum ColorType",
          'red = "red"',
          'green = "green"',
          'blue = "blue"',
        ]);

        const productFile = path.join(tmp, "Product.ts");
        const productContent = readFileSync(productFile, "utf8");
        expect(productContent).toContain(
          "import { ColorType } from './enums';"
        );
        expect(productContent).toMatch(
          /@XmlElement\('color',\s*\{\s*type:\s*ColorType,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
        );
        expect(productContent).toMatch(/color!?:\s*ColorType;/);
      });
    });

    test("generates inline enum for element with anonymous simpleType restriction", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:complexType name="Order">
    <xsd:sequence>
      <xsd:element name="status">
        <xsd:simpleType>
          <xsd:restriction base="xsd:string">
            <xsd:enumeration value="pending"/>
            <xsd:enumeration value="shipped"/>
            <xsd:enumeration value="delivered"/>
          </xsd:restriction>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        // Enums are now in consolidated enums.ts file
        const enumsFile = path.join(tmp, "enums.ts");
        const enumsContent = readFileSync(enumsFile, "utf8");
        expectStringsOnConsecutiveLines(enumsContent, [
          "export enum statusEnum",
          'pending = "pending"',
          'shipped = "shipped"',
          'delivered = "delivered"',
        ]);

        const orderFile = path.join(tmp, "Order.ts");
        const orderContent = readFileSync(orderFile, "utf8");
        expect(orderContent).toContain("import { statusEnum } from './enums';");
        expect(orderContent).toMatch(/status!?:\s*statusEnum;/);
      });
    });

    test("generates enum wrapper class for top-level element with enum type", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="SizeType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="small"/>
      <xsd:enumeration value="medium"/>
      <xsd:enumeration value="large"/>
    </xsd:restriction>
  </xsd:simpleType>
  <xsd:element name="Size" type="SizeType"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        // Enums are now in consolidated enums.ts file
        const enumsFile = path.join(tmp, "enums.ts");
        expect(readFileSync(enumsFile, "utf8")).toContain(
          "export enum SizeType"
        );

        const sizeFile = path.join(tmp, "Size.ts");
        const sizeContent = readFileSync(sizeFile, "utf8");
        expect(sizeContent).toContain("import { SizeType } from './enums';");
        expect(sizeContent).toMatch(/@XmlRoot\('Size'/);
        expect(sizeContent).toContain("@XmlText()");
        expect(sizeContent).toMatch(/value\?:\s*SizeType;/);
      });
    });

    test("generates inline enum for top-level element with anonymous enum simpleType", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:element name="Priority">
    <xsd:simpleType>
      <xsd:restriction base="xsd:string">
        <xsd:enumeration value="low"/>
        <xsd:enumeration value="medium"/>
        <xsd:enumeration value="high"/>
      </xsd:restriction>
    </xsd:simpleType>
  </xsd:element>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        // Enums are now in consolidated enums.ts file
        const enumsFile = path.join(tmp, "enums.ts");
        const enumsContent = readFileSync(enumsFile, "utf8");
        expectStringsOnConsecutiveLines(enumsContent, [
          "export enum PriorityEnum",
          'low = "low"',
          'medium = "medium"',
          'high = "high"',
        ]);

        const priorityFile = path.join(tmp, "Priority.ts");
        const priorityContent = readFileSync(priorityFile, "utf8");
        expect(priorityContent).toContain(
          "import { PriorityEnum } from './enums';"
        );
        expect(priorityContent).toMatch(/@XmlRoot\('Priority'/);
        expect(priorityContent).toMatch(/value\?:\s*PriorityEnum;/);
      });
    });

    test("handles enum values with special characters", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="SpecialType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="value-with-dash"/>
      <xsd:enumeration value="value.with.dot"/>
      <xsd:enumeration value="123numeric"/>
    </xsd:restriction>
  </xsd:simpleType>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        // Enums are now in consolidated enums.ts file
        const enumsFile = path.join(tmp, "enums.ts");
        const content = readFileSync(enumsFile, "utf8");

        expectStringsOnConsecutiveLines(content, [
          'value_with_dash = "value-with-dash"',
          'value_with_dot = "value.with.dot"',
          '_123numeric = "123numeric"',
        ]);
      });
    });

    test("generates array of enum values", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="TagType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="urgent"/>
      <xsd:enumeration value="important"/>
      <xsd:enumeration value="review"/>
    </xsd:restriction>
  </xsd:simpleType>
  <xsd:complexType name="Task">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string"/>
      <xsd:element name="tags" type="TagType" maxOccurs="unbounded" minOccurs="0"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        const taskFile = path.join(tmp, "Task.ts");
        const taskContent = readFileSync(taskFile, "utf8");

        expect(taskContent).toContain("import { TagType } from './enums';");
        expect(taskContent).toMatch(
          /@XmlElement\('tags',\s*\{\s*type:\s*TagType,\s*array:\s*true,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
        );
        expect(taskContent).toMatch(/tags\?:\s*TagType\[\];/);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined enum values", () => {
      const task = new EnumTask();
      const xml = marshal(task);
      expect(xml).not.toContain("<status>");
    });
  });
});
