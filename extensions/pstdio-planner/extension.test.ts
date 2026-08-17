import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "./extension";
import { putTicket } from "./src/data/collections";
import { ticketMarkdownPath } from "./src/data/draft-storage";
import { createMemoryStorage } from "./src/data/memory-storage";
import type { StoredTicket } from "./src/data/types";

const seedBacklogTicket = async (storage: ReturnType<typeof createMemoryStorage>) =>
  putTicket(storage, {
    id: "ticket-1",
    shorthand: "T-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "backlog",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    parallelizable: null,
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies StoredTicket);

describe("pstdio planner extension contributions", () => {
  test("contributes a ticket detail workbench mode", () => {
    expect(extension.modes?.ticket).toMatchObject({
      id: "pstdio-planner.ticket",
      label: { $l10n: "modes.ticket.label", default: "Ticket" },
      icon: "FileText",
      resourceKind: "ticket",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [{ region: "sidenav", panel: "ticketFiles", pinned: true }],
      },
    });
  });

  test("uses a native tree renderer for ticket files", () => {
    expect(extension.treeRenderers?.ticketFiles).toMatchObject({
      title: { $l10n: "treeRenderers.ticketFiles.title", default: "Files" },
      icon: "Files",
      bodyCommand: { id: "pstdio-planner.ticket-files.tree.body" },
      defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
    });
    expect(extension.panels?.ticketFiles).toMatchObject({
      title: { $l10n: "panels.ticketFiles.title", default: "Files" },
      region: "sidenav",
      closable: false,
      resourceKind: "ticket",
      treeRenderer: "ticketFiles",
    });
    expect(extension.panels?.ticketFiles).not.toHaveProperty("target");
    expect(extension.panels?.ticketFiles).not.toHaveProperty("webview");
  });

  test("contributes shared document templates and planner skills", () => {
    expect(extension.templateTypes?.document).toMatchObject({ label: "Document" });
    expect(extension.templates?.prd).toMatchObject({ title: "PRD", type: "document" });
    expect(extension.templates?.commit_message).toMatchObject({ title: "Commit message", type: "prompt" });
    expect(extension.skills?.create_ticket).toMatchObject({ title: "Create a ticket" });
    expect(extension.skills).not.toHaveProperty("create_pstdio_extension");
    expect(extension.skills).not.toHaveProperty("pstdio");
  });

  test("registers the link review ticket command", () => {
    expect(extension.commands?.["link-review"]).toMatchObject({
      title: "Link review",
      cli: { globalAliases: [["tickets", "link-review"]] },
    });
  });

  test("owns planner translation bundles and localizable contribution copy", () => {
    expect(extension.defaultLocale).toBe("en");
    expect(extension.translations).toEqual({
      es: expect.objectContaining({ kind: "package-asset" }),
      fr: expect.objectContaining({ kind: "package-asset" }),
      ja: expect.objectContaining({ kind: "package-asset" }),
      ko: expect.objectContaining({ kind: "package-asset" }),
      "zh-Hans": expect.objectContaining({ kind: "package-asset" }),
      "zh-Hant": expect.objectContaining({ kind: "package-asset" }),
    });
    expect(extension.kanbanRenderers?.tickets?.title).toEqual({
      $l10n: "kanbanRenderers.tickets.title",
      default: "Tickets",
    });
    expect(extension.kanbanRenderers?.tickets?.createRow).toMatchObject({
      columnParam: "statusId",
      attributesParam: "attributes",
      params: {
        content: {
          type: "markdown",
          label: { $l10n: "kanbanRenderers.tickets.createRow.content.label", default: "Description" },
          required: true,
        },
        files: { type: "files", multiple: true },
      },
      attachments: {
        resourceParam: "ticketId",
        fileParam: "ref",
      },
      labels: {
        cancel: { $l10n: "kanbanRenderers.tickets.createRow.cancel", default: "Cancel" },
      },
    });
    expect(extension.settingsPanels?.ticketStatuses?.title).toEqual({
      $l10n: "settingsPanels.ticketStatuses.title",
      default: "Ticket status",
    });
  });

  test("copies the linked ticket file when a ticket worktree is created", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const worktreePath = mkdtempSync(join(tmpdir(), "planner-worktree-"));

    try {
      await extension.hooks?.worktreeCreated.handler({ storage } as never, {
        projectId: "project-1",
        workspaceId: "workspace-1",
        repoPath: "/repo",
        workspaceDir: worktreePath,
        type: "worktree",
        branch: "workspace/T-1_A1",
        workspace: {
          id: "workspace-1",
          anchors_json: [
            { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
          ],
        },
      });

      const path = join(worktreePath, ticketMarkdownPath(ticket.shorthand));
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, "utf8")).toContain(ticket.content);
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  test("copies an existing local ticket file into a ticket worktree", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const repoPath = mkdtempSync(join(tmpdir(), "planner-repo-"));
    const worktreePath = mkdtempSync(join(tmpdir(), "planner-worktree-"));
    const repoTicketPath = join(repoPath, ticketMarkdownPath(ticket.shorthand));
    const localContent = "# Local ticket edits\n";
    mkdirSync(join(repoPath, ".pstdio", "tickets", ticket.shorthand), { recursive: true });
    writeFileSync(repoTicketPath, localContent);

    try {
      await extension.hooks?.worktreeCreated.handler({ storage } as never, {
        projectId: "project-1",
        workspaceId: "workspace-1",
        repoPath,
        workspaceDir: worktreePath,
        type: "worktree",
        branch: "workspace/T-1_A1",
        workspace: {
          id: "workspace-1",
          anchors_json: [
            { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
          ],
        },
      });

      expect(readFileSync(join(worktreePath, ticketMarkdownPath(ticket.shorthand)), "utf8")).toBe(localContent);
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  // Session-start ticket movement and loop automations live in the repo-local
  // pstdio-planner-loops extension; the planner keeps only worktreeCreated and the
  // blocked-notification hook.
  test("contributes no session-start or git hooks", () => {
    expect(Object.keys(extension.hooks ?? {}).sort()).toEqual(["sessionAwaitingInput", "worktreeCreated"]);
  });

  test("mounts run review in the workspace overflow menu", () => {
    expect(extension.commands?.runReview?.menus).toEqual([
      {
        target: "workbench.nav.overflow",
        label: { $l10n: "commands.runReview.menuLabel", default: "Run review" },
        icon: "clipboard-check",
        when: { resourceType: ["workspace"] },
      },
    ]);
  });

  test("runReview gets workspace identity from dashboard resource context", () => {
    expect(extension.commands?.runReview?.params?.workspaceId).toMatchObject({ required: false });
  });

  test("opens the tickets datatable as a board with core properties displayed", () => {
    expect(extension.kanbanRenderers?.tickets?.defaultSettings).toMatchObject({
      viewMode: "board",
      columnGrouping: "status",
      ordering: { attributeId: "created", direction: "desc" },
      displayProperties: ["id", "workspace", "type", "priority"],
    });
    expect(extension.kanbanRenderers?.tickets?.columnActionCommand).toEqual({
      id: "pstdio-planner.ticket-column-action",
    });
    expect(extension.kanbanRenderers?.tickets?.onRowActivate).toBeFunction();
  });

  test("exposes ticket workspace creation as an extension-owned row action", () => {
    expect(extension.kanbanRenderers?.tickets?.rowActions).toContainEqual({
      id: "create-workspace",
      label: { $l10n: "kanbanRenderers.tickets.rowActions.createWorkspace", default: "Create workspace" },
      icon: "git-branch",
      command: { id: "pstdio-planner.create-workspace" },
    });
  });

  test("contributes only ticket settings panels", () => {
    expect(Object.keys(extension.settingsPanels ?? {}).sort()).toEqual(["ticketStatuses", "ticketTags"]);
  });
});

describe("pstdio planner notification hooks", () => {
  test("creates blocked notifications from session anchors when workspace anchors are empty", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const notifications: unknown[] = [];

    await extension.hooks?.sessionAwaitingInput.handler(
      {
        storage,
        notify: {
          action: async (input: unknown) => {
            notifications.push(input);
            return {};
          },
        },
      } as never,
      {
        projectId: "project-1",
        sessionId: "session-1",
        workspace: { anchors_json: [] },
        anchors: [{ type: "ticket", id: ticket.id, label: ticket.shorthand }],
      } as never,
    );

    expect(notifications).toEqual([
      expect.objectContaining({
        dedupeKey: "pstdio-planner:ticket:T-1:blocked",
        kind: "blocked",
      }),
    ]);
  });
});
