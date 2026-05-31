import { describe, expect, test } from "bun:test";
import extension from "./extension";

const nonAssetSurfaces = [
  "activityRenderers",
  "artifactMounts",
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
  test("contributes ticket skills, templates, and ticket actions", () => {
    expect(Object.keys(extension.commands ?? {}).sort()).toEqual([
      "break-into-sub-tickets",
      "refine-ticket",
      "run-attempt",
    ]);
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

    expect(extension.commands?.["run-attempt"]?.menus).toEqual([
      { slot: "ticket.headerPrimary", label: "Run attempt" },
    ]);
    expect(extension.commands?.["refine-ticket"]?.menus).toEqual([
      { slot: "ticket.headerOverflow", label: "Refine ticket" },
    ]);
    expect(extension.commands?.["break-into-sub-tickets"]?.menus).toEqual([
      { slot: "ticket.headerOverflow", label: "Break into sub-tickets" },
    ]);

    for (const surface of nonAssetSurfaces) {
      expect(extension[surface], surface).toBeUndefined();
    }
  });

  test("run-attempt creates an attempt for the selected ticket", async () => {
    const attempts: unknown[] = [];

    await extension.commands?.["run-attempt"]?.run({
      params: {
        ticket: "PS-304",
        agent: { harnessId: "codex", model: "gpt-5" },
        repo: { repoId: "repo-1", branch: "main" },
      },
      tickets: {
        createAttempt: async (input: unknown) => {
          attempts.push(input);
          return {};
        },
      },
    } as never);

    expect(attempts).toEqual([
      {
        ticket: "PS-304",
        agent: "codex",
        model: "gpt-5",
        repoId: "repo-1",
        branch: "main",
        prompt: "Implement ticket: PS-304",
      },
    ]);
  });

  test("refine-ticket starts a refinement session with optional context", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.["refine-ticket"]?.run({
      params: {
        ticket: "PS-304",
        agent: { harnessId: "codex", model: "gpt-5" },
        template: "bug-fix",
        context: "Tighten the acceptance criteria.",
      },
      sessions: {
        create: async (input: unknown) => {
          sessions.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(sessions).toEqual([
      {
        title: "Refine ticket: PS-304",
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "refine-ticket",
        vars: {
          ticket: "PS-304",
          templateName: "bug-fix",
          additionalContext: "Tighten the acceptance criteria.",
        },
      },
    ]);
  });

  test("break-into-sub-tickets starts a breakdown session", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.["break-into-sub-tickets"]?.run({
      params: {
        ticket: "PS-304",
        agent: { harnessId: "codex", model: "gpt-5" },
        template: "ticket",
      },
      sessions: {
        create: async (input: unknown) => {
          sessions.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(sessions).toEqual([
      {
        title: "Break into sub-tickets: PS-304",
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "create-sub-tickets",
        vars: {
          ticket: "PS-304",
          templateName: "ticket",
        },
      },
    ]);
  });
});
