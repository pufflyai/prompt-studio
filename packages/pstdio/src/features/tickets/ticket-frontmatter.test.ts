import { describe, expect, test } from "bun:test";
import {
  applyFrontmatter,
  applyFrontmatterValues,
  buildTicketFrontmatter,
  parseFrontmatter,
} from "./ticket-frontmatter";

const baseFields = {
  shorthand: "PS-1",
  created_at: "2026-03-04T00:00:00.000Z",
  draft: null,
  status_name: null,
  parent_id: null,
  user_prompt: null,
  depends_on: null,
  parallelizable: null,
  blocked_reason: null,
  tag_names: [] as string[],
};

describe("buildTicketFrontmatter", () => {
  test("builds frontmatter from ticket fields", () => {
    const result = buildTicketFrontmatter({
      shorthand: "PS-12",
      created_at: "2026-03-04T00:00:00.000Z",
      draft: true,
      status_name: "backlog",
      parent_id: "PS-5",
      user_prompt: "Build the feature",
      depends_on: "PS-3,PS-4",
      parallelizable: "yes",
      blocked_reason: "waiting on API",
      tag_names: [],
    });

    expect(result).toBe(
      [
        "---",
        'ticket_id: "PS-12"',
        'user_prompt: "Build the feature"',
        'created: "2026-03-04T00:00:00.000Z"',
        "draft: true",
        'status: "backlog"',
        'parent_id: "PS-5"',
        'depends_on: "PS-3,PS-4"',
        'parallelizable: "yes"',
        'blocked_reason: "waiting on API"',
        "---",
      ].join("\n"),
    );
  });

  test("escapes double quotes in values", () => {
    const result = buildTicketFrontmatter({ ...baseFields, user_prompt: 'She said "hello"' });
    expect(result).toContain('user_prompt: "She said \\"hello\\""');
  });

  test("escapes newlines in values", () => {
    const result = buildTicketFrontmatter({ ...baseFields, user_prompt: "line one\nline two" });
    expect(result).toContain('user_prompt: "line one\\nline two"');
  });

  test("escapes backslashes in values", () => {
    const result = buildTicketFrontmatter({ ...baseFields, user_prompt: "path\\to\\file" });
    expect(result).toContain('user_prompt: "path\\\\to\\\\file"');
  });

  test("omits null/empty fields", () => {
    const result = buildTicketFrontmatter(baseFields);
    expect(result).toBe(["---", 'ticket_id: "PS-1"', 'created: "2026-03-04T00:00:00.000Z"', "---"].join("\n"));
  });

  test("includes tags in frontmatter", () => {
    const result = buildTicketFrontmatter({ ...baseFields, tag_names: ["bug", "P1"] });
    expect(result).toContain('tags: ["bug", "P1"]');
  });
});

describe("applyFrontmatter", () => {
  test("prepends frontmatter to body without existing frontmatter", () => {
    const result = applyFrontmatter('---\nticket_id: "PS-1"\n---', "# My Ticket\n\nBody text");
    expect(result).toBe('---\nticket_id: "PS-1"\n---\n\n# My Ticket\n\nBody text');
  });

  test("replaces existing frontmatter", () => {
    const content = '---\nticket_id: "PS-1"\nstatus: "old"\n---\n\n# My Ticket\n\nBody text';
    const result = applyFrontmatter('---\nticket_id: "PS-1"\nstatus: "new"\n---', content);
    expect(result).toBe('---\nticket_id: "PS-1"\nstatus: "new"\n---\n\n# My Ticket\n\nBody text');
  });

  test("handles content that is only frontmatter", () => {
    const content = '---\nticket_id: "PS-1"\n---';
    const result = applyFrontmatter('---\nticket_id: "PS-1"\nstatus: "wip"\n---', content);
    expect(result).toBe('---\nticket_id: "PS-1"\nstatus: "wip"\n---');
  });

  test("handles empty content", () => {
    const result = applyFrontmatter('---\nticket_id: "PS-1"\n---', "");
    expect(result).toBe('---\nticket_id: "PS-1"\n---');
  });
});

describe("parseFrontmatter", () => {
  test("extracts all known fields from frontmatter", () => {
    const content = [
      "---",
      'ticket_id: "PS-12"',
      'status: "wip"',
      'priority: "P1"',
      'parent_id: "PS-5"',
      'depends_on: "PS-3,PS-4"',
      'parallelizable: "yes"',
      'blocked_reason: "waiting on API"',
      "---",
      "",
      "# My Ticket",
    ].join("\n");

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      status: "wip",
    });
  });

  test("returns empty object when no frontmatter", () => {
    expect(parseFrontmatter("# Just a heading")).toEqual({});
  });

  test("returns empty object when frontmatter has no actionable fields", () => {
    const content = '---\nticket_id: "PS-1"\ncreated: "2026-01-01"\n---\n\n# Ticket';
    expect(parseFrontmatter(content)).toEqual({});
  });

  test("ignores fields with empty values", () => {
    const content = '---\nstatus: ""\n---\n\n# Ticket';
    expect(parseFrontmatter(content)).toEqual({});
  });

  test("strips quotes from values", () => {
    const content = "---\nstatus: backlog\n---\n\n# Ticket";
    expect(parseFrontmatter(content)).toEqual({ status: "backlog" });
  });
});

describe("applyFrontmatterValues", () => {
  test("applies generated values over template frontmatter and preserves custom keys", () => {
    const frontmatter = [
      "---",
      'ticket_id: "PS-5"',
      'created: "2026-03-04T00:00:00.000Z"',
      "draft: true",
      'status: "wip"',
      "---",
    ].join("\n");
    const content = ["---", 'ticket_id: "OLD-1"', 'parallelizable: "[no|yes]"', "---", "", "# Ticket"].join("\n");

    const result = applyFrontmatterValues(frontmatter, content);

    expect(result).toContain('ticket_id: "PS-5"');
    expect(result).toContain('created: "2026-03-04T00:00:00.000Z"');
    expect(result).toContain("draft: true");
    expect(result).toContain('status: "wip"');
    expect(result).toContain('parallelizable: "[no|yes]"');
  });

  test("creates frontmatter when content has none", () => {
    const frontmatter = ["---", 'ticket_id: "PS-1"', "draft: true", "---"].join("\n");

    const result = applyFrontmatterValues(frontmatter, "# Ticket");

    expect(result).toBe(["---", 'ticket_id: "PS-1"', "draft: true", "---", "", "# Ticket"].join("\n"));
  });

  test("replaces existing generated keys", () => {
    const frontmatter = ["---", "draft: true", "---"].join("\n");
    const content = ["---", "draft: false", "---", "", "# Ticket"].join("\n");

    const result = applyFrontmatterValues(frontmatter, content);

    expect(result).toContain("draft: true");
    expect(result).not.toContain("draft: false");
  });
});
