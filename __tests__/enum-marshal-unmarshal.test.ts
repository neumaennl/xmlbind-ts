import { XmlRoot, XmlElement, XmlAttribute, XmlText } from "../src/decorators";
import { marshal, unmarshal } from "../src/marshalling";

// Define test enum
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

describe("Enum marshalling and unmarshalling", () => {
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
    expect(task.id).toBe("1"); // Attributes are parsed as strings
    expect(task.title).toBe("Review PR");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("high");
    expect(task.tags).toEqual(["code-review", "urgent"]);
  });

  test("marshal object with enum values to XML", () => {
    const task = new Task();
    task.id = 2;
    task.title = "Fix bug";
    task.status = StatusEnum.approved;
    task.priority = PriorityEnum.medium;
    task.tags = ["bugfix", "backend"];

    const xml = marshal(task);

    expect(xml).toContain('id="2"');
    expect(xml).toContain("<title>Fix bug</title>");
    expect(xml).toContain("<status>approved</status>");
    expect(xml).toContain("<priority>medium</priority>");
    expect(xml).toContain("<tags>bugfix</tags>");
    expect(xml).toContain("<tags>backend</tags>");
  });

  test("roundtrip with enum values", () => {
    const task = new Task();
    task.id = 3;
    task.title = "Deploy";
    task.status = StatusEnum.rejected;
    task.priority = PriorityEnum.low;

    const xml = marshal(task);
    const unmarshalled = unmarshal(Task, xml);

    expect(unmarshalled.id).toBe("3"); // Attributes come back as strings
    expect(unmarshalled.title).toBe(task.title);
    expect(unmarshalled.status).toBe("rejected");
    expect(unmarshalled.priority).toBe("low");
  });

  test("unmarshal enum as text content", () => {
    const xml = `<?xml version="1.0"?>
<Config>approved</Config>`;

    const config = unmarshal(Config, xml);

    expect(config).toBeInstanceOf(Config);
    expect(config.value).toBe("approved");
  });

  test("marshal enum as text content", () => {
    const config = new Config();
    config.value = StatusEnum.pending;

    const xml = marshal(config);

    expect(xml).toContain("<Config>pending</Config>");
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

  test("preserve enum type through marshalling", () => {
    const task = new Task();
    task.title = "Test task";
    task.status = StatusEnum.approved;

    const xml = marshal(task);

    // The marshalled XML should contain the string value
    expect(xml).toContain("<status>approved</status>");

    // When unmarshalled, we get back the string (which matches the enum value)
    const unmarshalled = unmarshal(Task, xml);
    expect(unmarshalled.status).toBe(StatusEnum.approved);
    expect(unmarshalled.status).toBe("approved");
  });
});
