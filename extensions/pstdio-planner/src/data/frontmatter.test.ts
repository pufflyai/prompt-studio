import { describe, expect, test } from "bun:test";
import { buildTicketFrontmatter, parseTicketFrontmatter } from "./frontmatter";

describe("ticket frontmatter", () => {
  test("parses depends_on as a ticket list", () => {
    const empty = parseTicketFrontmatter(["---", "depends_on: []", "---"].join("\n"));
    const populated = parseTicketFrontmatter(["---", 'depends_on: ["T-1", "T-2"]', "---"].join("\n"));

    expect(empty.dependsOn).toEqual([]);
    expect(populated.dependsOn).toEqual(["T-1", "T-2"]);
  });

  test("writes depends_on as a ticket list", () => {
    const frontmatter = buildTicketFrontmatter({
      shorthand: "T-3",
      createdAt: "2026-06-08T10:00:00.000Z",
      draft: true,
      parentShorthand: null,
      userPrompt: null,
      dependsOn: ["T-1", "T-2"],
      parallelizable: null,
      blockedReason: null,
      tagNames: [],
    });

    expect(frontmatter).toContain('depends_on: ["T-1", "T-2"]');
  });
});
