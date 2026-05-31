import { describe, expect, test } from "bun:test";
import extension from "./extension";

const nonAssetSurfaces = [
  "activityRenderers",
  "artifactMounts",
  "commands",
  "dataRenderers",
  "fileIconThemes",
  "harnesses",
  "hooks",
  "initialSetup",
  "middlewares",
  "migrate",
  "modes",
  "routes",
  "schedules",
  "sessionAnchorRenderers",
  "settings",
  "settingsPanels",
  "themes",
  "treeItems",
  "views",
  "workspaceTypes",
] as const;

describe("pstdio-core-tickets extension", () => {
  test("only contributes ticket skills and templates", () => {
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

    for (const surface of nonAssetSurfaces) {
      expect(extension[surface], surface).toBeUndefined();
    }
  });
});
