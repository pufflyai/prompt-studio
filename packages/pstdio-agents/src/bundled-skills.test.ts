import { describe, expect, test } from "bun:test";
import { getBundledSkills } from "./bundled-skills";

const makeEmbeddedFile = (name: string, content: string) => {
  const blob = new Blob([content], { type: "text/markdown" });
  return Object.assign(blob, { name });
};

describe("getBundledSkills", () => {
  test("prefers embedded skill files in compiled runtime", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = [
      makeEmbeddedFile(
        "../../pstdio-agents/files/skills/alpha/SKILL.md",
        `---
name: "alpha"
description: "Alpha skill"
---
alpha content
`,
      ),
      makeEmbeddedFile(
        "../../pstdio-agents/files/skills/bravo/SKILL.md",
        `---
name: "bravo"
description: "Bravo skill"
---
bravo content
`,
      ),
    ];

    try {
      const skills = await getBundledSkills();
      expect(skills).toEqual([
        { name: "alpha", description: "Alpha skill", content: expect.stringContaining("alpha content") },
        { name: "bravo", description: "Bravo skill", content: expect.stringContaining("bravo content") },
      ]);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });
});
