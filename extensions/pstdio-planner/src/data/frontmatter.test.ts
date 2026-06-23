import { describe, expect, test } from "bun:test";
import { buildTicketFrontmatter, parseTicketFrontmatter, stripFrontmatter } from "./frontmatter";

describe("ticket frontmatter", () => {
  test("parses depends_on as a ticket list", () => {
    const empty = parseTicketFrontmatter(["---", "depends_on: []", "---"].join("\n"));
    const populated = parseTicketFrontmatter(["---", 'depends_on: ["T-1", "T-2"]', "---"].join("\n"));

    expect(empty.dependsOn).toEqual([]);
    expect(populated.dependsOn).toEqual(["T-1", "T-2"]);
  });

  test("treats empty quoted scalars as absent so they round-trip with the serializer", () => {
    const parsed = parseTicketFrontmatter(
      ["---", 'ticket_id: "D-1"', 'parent_id: ""', 'blocked_reason: ""', "---"].join("\n"),
    );

    expect(parsed.parentShorthand).toBeUndefined();
    expect(parsed.blockedReason).toBeUndefined();
  });

  test("round-trips depends_on through build and parse", () => {
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

    const parsed = parseTicketFrontmatter(frontmatter);

    expect(parsed.dependsOn).toEqual(["T-1", "T-2"]);
  });

  test("ignores triple dashes inside frontmatter values", () => {
    const markdown = ["---", 'ticket_id: "T-1"', 'user_prompt: "before --- after"', "---", "", "# Body"].join("\n");

    expect(parseTicketFrontmatter(markdown).userPrompt).toBe("before --- after");
    expect(stripFrontmatter(markdown)).toContain("# Body");
  });
});
