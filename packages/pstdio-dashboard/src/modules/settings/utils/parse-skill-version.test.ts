import { describe, expect, test } from "bun:test";
import { parseSkillVersion } from "./parse-skill-version";

describe("parseSkillVersion", () => {
  test("reads the skill version from metadata frontmatter", () => {
    expect(
      parseSkillVersion(`---
name: create-ticket
metadata:
  version: 0.0.2
---

# Create Ticket
`),
    ).toBe("0.0.2");
  });

  test("reads installed skill versions from list-shaped metadata", () => {
    expect(
      parseSkillVersion(`---
metadata:
  - version: 1.3.0
---
`),
    ).toBe("1.3.0");
  });
});
