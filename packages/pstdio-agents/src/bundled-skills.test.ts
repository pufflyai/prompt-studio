import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
      makeEmbeddedFile("../../pstdio-agents/files/skills/alpha/templates/proposal.md", "# template"),
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
          files: [
            {
              path: "SKILL.md",
              content: expect.stringContaining("alpha content"),
              encoding: "utf8",
            },
            {
              path: "templates/proposal.md",
              content: "# template",
              encoding: "utf8",
            },
          ],
        },
        {
          name: "bravo",
          description: "Bravo skill",
          version: "",
          files: [
            {
              path: "SKILL.md",
              content: expect.stringContaining("bravo content"),
              encoding: "utf8",
            },
          ],
        },
      ]);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });

  test("loads full skill trees from filesystem", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = [];

    try {
      const skills = await getBundledSkills();
      const multiFile = skills.find((skill) => skill.files.length > 1);
      expect(multiFile).toBeDefined();
      expect(multiFile?.files.some((file) => file.path === "SKILL.md")).toBe(true);
    } finally {
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });

  test("ignores filesystem skill folders missing SKILL.md", async () => {
    const runtime = Bun as unknown as { embeddedFiles: (Blob & { name: string })[] };
    const originalEmbeddedFiles = runtime.embeddedFiles;
    runtime.embeddedFiles = [];

    const invalidSkillDir = join(import.meta.dirname, "../files/skills/__invalid-skill-test__");
    mkdirSync(invalidSkillDir, { recursive: true });
    writeFileSync(join(invalidSkillDir, "notes.md"), "# no entrypoint", "utf8");

    try {
      const skills = await getBundledSkills();
      expect(skills.some((skill) => skill.name === "__invalid-skill-test__")).toBe(false);
    } finally {
      rmSync(invalidSkillDir, { recursive: true, force: true });
      runtime.embeddedFiles = originalEmbeddedFiles;
    }
  });
});
