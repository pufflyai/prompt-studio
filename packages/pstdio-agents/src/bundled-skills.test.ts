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
metadata:
  - version: 1.2.3
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
        {
          name: "alpha",
          description: "Alpha skill",
          version: "1.2.3",
          content: expect.stringContaining("alpha content"),
        },
        { name: "bravo", description: "Bravo skill", version: "", content: expect.stringContaining("bravo content") },
      ]);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });

  test("loads version metadata from bundled skill frontmatter", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] | undefined };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = [];

    try {
      const skills = await getBundledSkills();

      expect(skills).not.toHaveLength(0);
      for (const skill of skills) {
        const expectedVersion = skill.name === "pstdio" ? "0.0.2" : "0.0.1";
        expect(skill.content).toContain(`metadata:\n  - version: ${expectedVersion}`);
      }
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });

  test("update-documentation explains how to initialize docs when missing", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] | undefined };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = [];

    try {
      const skills = await getBundledSkills();
      const skill = skills.find((entry) => entry.name === "update-documentation");

      expect(skill).toBeDefined();
      expect(skill?.content).toContain("pstdio docs init");
      expect(skill?.content).toContain("If `.pstdio/docs/navigation.json` is missing");
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });
});
