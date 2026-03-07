import { describe, expect, test } from "bun:test";
import { replacePlaceholders } from "./replace-placeholders";

describe("replacePlaceholders", () => {
  test("replaces standard placeholders", () => {
    const content = "# {{TICKET_TITLE}}\nID: {{TICKET_ID}}\nCreated: {{CREATED_AT}}";
    const result = replacePlaceholders(content, {
      TICKET_TITLE: "Fix login bug",
      TICKET_ID: "PS-12",
      CREATED_AT: "2026-01-01T00:00:00.000Z",
    });

    expect(result).toBe("# Fix login bug\nID: PS-12\nCreated: 2026-01-01T00:00:00.000Z");
  });

  test("replaces multiple occurrences of the same placeholder", () => {
    const content = "{{TICKET_ID}} - see {{TICKET_ID}}";
    const result = replacePlaceholders(content, { TICKET_ID: "PS-5" });
    expect(result).toBe("PS-5 - see PS-5");
  });

  test("clears unmatched placeholders", () => {
    const content = "# {{TICKET_TITLE}} - {{UNKNOWN}}";
    const result = replacePlaceholders(content, { TICKET_TITLE: "Hello" });
    expect(result).toBe("# Hello - ");
  });

  test("handles empty values", () => {
    const content = "Parent: {{PARENT_ID}}";
    const result = replacePlaceholders(content, { PARENT_ID: "" });
    expect(result).toBe("Parent: ");
  });

  test("handles no placeholders", () => {
    const content = "No placeholders here";
    const result = replacePlaceholders(content, { TICKET_ID: "PS-1" });
    expect(result).toBe("No placeholders here");
  });
});
