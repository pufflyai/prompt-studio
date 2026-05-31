import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-core-tickets catalog", () => {
  test("contributes only ticket skills and templates", () => {
    expect(Object.keys(extension.skills ?? {}).sort()).toEqual([
      "create_proposal",
      "create_sub_tickets",
      "create_ticket",
      "implement_ticket",
      "refine_ticket",
    ]);
    expect(Object.keys(extension.templates ?? {}).sort()).toEqual([
      "bug_fix",
      "create_sub_tickets",
      "fix_changes_requested",
      "implement_ticket",
      "proposal",
      "refine_ticket",
      "review_code",
      "ticket",
    ]);
    expect(extension.templateTypes).toMatchObject({
      prompt: { label: "Prompt" },
      ticket: { label: "Ticket" },
    });
    expect(extension.initialSetup).toBeUndefined();
    expect(extension.commands).toBeUndefined();
    expect(extension.middlewares).toBeUndefined();
    expect(extension.hooks).toBeUndefined();
    expect(extension.routes).toBeUndefined();
    expect(extension.treeItems).toBeUndefined();
    expect(extension.settingsPanels).toBeUndefined();
    expect(extension.dataRenderers).toBeUndefined();
    expect(extension.documentEditors).toBeUndefined();
  });
});
