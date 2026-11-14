import { describe, expect, test } from "bun:test";
import { parseSkillMetadata } from "./parse-skill-metadata";

describe("skill frontmatter metadata", () => {
  test("reads the frontmatter description even when catalog metadata is absent", () => {
    expect(
      parseSkillMetadata(`---
name: create-ticket
description: "Create a ticket: describe the problem."
metadata:
  version: 0.0.2
---
# Create Ticket
`),
    ).toEqual({ name: "create-ticket", description: "Create a ticket: describe the problem.", version: "0.0.2" });
  });

  test("reads folded and literal multiline descriptions", () => {
    expect(parseSkillMetadata("---\ndescription: >-\n  Create tickets\n  from a request.\n---\n").description).toBe(
      "Create tickets from a request.",
    );
    expect(parseSkillMetadata("---\ndescription: |-\n  First line.\n  Second line.\n---\n").description).toBe(
      "First line.\nSecond line.",
    );
  });

  test("reads root versions and existing list-shaped metadata", () => {
    expect(parseSkillMetadata("---\nversion: 1.2.3\n---\n").version).toBe("1.2.3");
    expect(parseSkillMetadata("---\nmetadata:\n  - version: 1.3.0\n---\n").version).toBe("1.3.0");
  });

  test("does not mistake document body fields for frontmatter", () => {
    expect(parseSkillMetadata("# Example\nname: misleading\nversion: 99\ndescription: body text")).toEqual({
      name: "",
      version: "",
      description: "",
    });
    expect(parseSkillMetadata("---\nname: skill\n---\nversion: 99\ndescription: body text")).toEqual({
      name: "skill",
      version: "",
      description: "",
    });
  });

  test("handles CRLF, missing metadata and malformed YAML without breaking the viewer", () => {
    expect(parseSkillMetadata("---\r\nname: skill\r\ndescription: Test\r\n---\r\n")).toEqual({
      name: "skill",
      description: "Test",
      version: "",
    });
    for (const input of ["", "---\nname: skill", "---\ndescription: [\n---\n", "---\n- item\n---\n"]) {
      expect(parseSkillMetadata(input)).toEqual({ name: "", description: "", version: "" });
    }
  });
});
