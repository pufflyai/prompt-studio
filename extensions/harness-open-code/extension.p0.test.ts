import { describe, expect, test } from "bun:test";
import { provisionOpencodeSkills } from "./extension";

describe("provisionOpencodeSkills", () => {
  test("refreshes managed legacy skill collisions without touching unrelated OpenCode skills", async () => {
    const syncCalls: Array<{ dir: string; files: Array<{ path: string; content: string }> }> = [];
    const checkedPaths: string[] = [];

    await provisionOpencodeSkills({
      skills: {
        list: async () => [
          {
            name: "implement-ticket",
            source_kind: "extension",
            files: [
              { path: "SKILL.md", content: "current implementation guidance", encoding: "utf8" },
              { path: "references/statuses.md", content: "ticket statuses", encoding: "utf8" },
            ],
          },
          {
            name: "custom-project-skill",
            source_kind: "project",
            files: [{ path: "SKILL.md", content: "custom", encoding: "utf8" }],
          },
        ],
      },
      workspaceFiles: {
        exists: async (path) => {
          checkedPaths.push(path);
          return path === ".opencode/skills/implement-ticket";
        },
        syncDir: async (dir, files) => {
          syncCalls.push({ dir, files });
        },
      },
    });

    expect(checkedPaths).toEqual([".opencode/skills/implement-ticket"]);
    expect(syncCalls).toEqual([
      {
        dir: ".agents/skills",
        files: [
          { path: "implement-ticket/SKILL.md", content: "current implementation guidance" },
          { path: "implement-ticket/references/statuses.md", content: "ticket statuses" },
          { path: "custom-project-skill/SKILL.md", content: "custom" },
        ],
      },
      {
        dir: ".opencode/skills/implement-ticket",
        files: [
          { path: "SKILL.md", content: "current implementation guidance" },
          { path: "references/statuses.md", content: "ticket statuses" },
        ],
      },
    ]);
  });
});
