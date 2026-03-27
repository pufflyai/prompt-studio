import { describe, expect, test } from "bun:test";
import { parseSkillVersion } from "./parse-skill-version";

describe("parseSkillVersion", () => {
  test("extracts version from skill frontmatter", () => {
    const content = `---
name: refine-ticket
description: "Some description"
metadata:
  - version: 0.0.1
---

## Workflow
`;
    expect(parseSkillVersion(content)).toBe("0.0.1");
  });

  test("returns empty string when no version found", () => {
    const content = `---
name: some-skill
description: "No version"
---

Content here.
`;
    expect(parseSkillVersion(content)).toBe("");
  });
});
