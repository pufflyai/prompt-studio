import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "./extension";
import { putTicket } from "./src/data/collections";
import { ticketMarkdownPath } from "./src/data/draft-storage";
import { createMemoryStorage } from "./src/data/memory-storage";
import type { StoredTicket } from "./src/data/types";

const command = (id: string) => extension.commands?.find((contribution) => contribution.id === id);
const hook = (id: string) => extension.hooks?.find((contribution) => contribution.id === id);
const skill = (id: string) => extension.skills?.find((contribution) => contribution.id === id);
const template = (id: string) => extension.templates?.find((contribution) => contribution.id === id);
const templateType = (id: string) => extension.templateTypes?.find((contribution) => contribution.id === id);

const fileMount = (root: string) => ({
  exists: async (path: string) => existsSync(join(root, path)),
  readText: async (path: string) => readFileSync(join(root, path), "utf8"),
  writeText: async (path: string, content: string) => {
    const absolutePath = join(root, path);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, content);
  },
});

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
  test("contributes the ticket resource without a ticket mode", () => {
    // A ticket is a resource. A ticket mode would reshape the workbench on open and
    // drop the project chrome the user had.
    expect(extension.modes).toBeUndefined();
    expect(extension.resourceKinds?.[0]).toMatchObject({ id: "ticket", surface: "primary" });
    expect(extension.resourcePanels).toBeUndefined();
    expect(extension.resourceViews?.map((binding) => binding.id)).toEqual(["ticket-editor", "ticket-files"]);
    expect(extension.viewMenus?.[0]).toMatchObject({
      id: "ticket.properties",
      owner: { id: "ticket-editor" },
      view: { id: "ticket-properties" },
      side: "right",
    });
    expect(extension.placements?.find((placement) => placement.id === "ticket-primary.project")).toMatchObject({
      region: "main",
      required: true,
      item: { kind: "resource-slot", slot: { id: "primary" } },
    });
    expect(extension.placements?.find((placement) => placement.id === "ticket-navigation.project")).toMatchObject({
      region: "sidenav",
      required: true,
      item: { kind: "resource-slot", slot: { id: "navigation" } },
    });
  });

  test("uses a native tree body for ticket files", () => {
    expect(extension.views?.find((view) => view.id === "ticket-files")).toMatchObject({
      title: { $l10n: "panels.ticketFiles.title", default: "Files" },
      icon: "Files",
      body: {
        kind: "tree",
        body: expect.any(Function),
        defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
      },
    });
  });

  test("refreshes native ticket view bodies from the shared ticket event", () => {
    const event = { extensionId: "pstdio.pstdio-planner", id: "tickets.changed", kind: "event" };

    for (const id of ["ticket-files", "ticket-editor", "ticket-properties", "tickets"]) {
      expect(extension.views?.find((view) => view.id === id)?.body.refreshEvents).toEqual([event]);
    }
  });

  test("contributes shared document templates and planner skills", () => {
    expect(templateType("document")).toMatchObject({ label: "Document" });
    expect(template("prd")).toMatchObject({ title: "PRD", type: "document" });
    expect(template("commit_message")).toMatchObject({ title: "Commit message", type: "prompt" });
    expect(skill("create_ticket")).toMatchObject({ title: "Create a ticket" });
    expect(skill("create_pstdio_extension")).toBeUndefined();
    expect(skill("pstdio")).toBeUndefined();
  });

  test("registers the link review ticket command", () => {
    expect(command("link-review")).toMatchObject({
      title: "Link review",
      cli: { globalAliases: [["tickets", "link-review"]] },
    });
  });

  test("exposes manual planner settings commands through the CLI", () => {
    expect(command("ticketStatus.update")?.cli).toEqual({
      globalAliases: [["statuses", "update"]],
      examples: ["pstdio statuses update --status-id backlog --label Backlog"],
    });
    expect(command("ticketStatus.reorder")?.cli).toEqual({
      globalAliases: [["statuses", "reorder"]],
      examples: ['pstdio statuses reorder --status-ids \'["backlog","ready"]\''],
    });
    expect(command("ticketTag.update")).toMatchObject({
      cli: {
        globalAliases: [["tags", "update"]],
        examples: ["pstdio tags update --tag-id default-priority --sort-order 0"],
      },
      params: { sortOrder: { type: "number" } },
    });
    expect(command("ticketTag.createOption")?.cli).toMatchObject({
      globalAliases: [["tags", "options", "create"]],
    });
    expect(command("ticketTag.updateOption")?.cli).toMatchObject({
      globalAliases: [["tags", "options", "update"]],
    });
    expect(command("ticketTag.deleteOption")?.cli).toMatchObject({
      globalAliases: [["tags", "options", "delete"]],
    });
    expect(command("ticketTag.applyDraft")?.cli).toMatchObject({
      globalAliases: [["tags", "apply-draft"]],
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
    const tickets = extension.views?.find((view) => view.id === "tickets");
    expect(tickets?.title).toEqual({
      $l10n: "kanbanRenderers.tickets.title",
      default: "Tickets",
    });
    expect(tickets?.body.kind === "kanban" ? tickets.body.createRow : undefined).toMatchObject({
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
    expect(extension.statuses?.[0]?.title).toBe("Ticket status");
  });
});

describe("pstdio planner workspace contributions", () => {
  test("copies the linked ticket file when a ticket worktree is created", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const worktreePath = mkdtempSync(join(tmpdir(), "planner-worktree-"));

    try {
      await hook("worktree-created")?.run(
        {
          storage,
          repoFiles: fileMount(worktreePath),
          workspaceFiles: fileMount(worktreePath),
        } as never,
        {
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
        },
      );

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
      await hook("worktree-created")?.run(
        {
          storage,
          repoFiles: fileMount(repoPath),
          workspaceFiles: fileMount(worktreePath),
        } as never,
        {
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
        },
      );

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
    expect(extension.hooks?.map((contribution) => contribution.id).sort()).toEqual([
      "session-awaiting-input",
      "worktree-created",
    ]);
  });

  test("mounts run review in the workspace overflow menu", () => {
    expect(command("runReview")?.menus).toMatchObject([
      {
        slot: { id: "workspace.headerOverflow", kind: "menu" },
        label: { $l10n: "commands.runReview.menuLabel", default: "Run review" },
        icon: "clipboard-check",
        when: { resourceType: [{ extensionId: "pstdio", id: "workspace", kind: "resource-kind" }] },
      },
    ]);
  });

  test("runReview only exposes workspace and harness options", () => {
    const runReview = command("runReview");

    expect(Object.keys(runReview?.params ?? {}).sort()).toEqual(["harness", "workspaceId"]);
    expect(runReview?.params?.workspaceId).toMatchObject({ required: false });
  });

  test("places the tickets Kanban view with core properties displayed", () => {
    const tickets = extension.views?.find((view) => view.id === "tickets");
    if (tickets?.body.kind !== "kanban") throw new Error("Tickets view must use a Kanban body");
    expect(tickets.body.defaultFilters).toEqual({ archived: ["active"] });
    expect(tickets.body.defaultSettings).toMatchObject({
      viewMode: "board",
      columnGrouping: "status",
      ordering: { attributeId: "created", direction: "desc" },
      displayProperties: ["id", "workspace", "type", "priority"],
    });
    expect(tickets.body.onColumnAction).toBeFunction();
    expect(tickets.body.onRowActivate).toBeFunction();
    expect(extension.placements?.find((placement) => placement.id === "tickets.project")).toMatchObject({
      region: "main",
      item: { kind: "view", view: tickets.ref },
    });
  });

  test("exposes ticket workspace creation as an extension-owned row action", () => {
    const tickets = extension.views?.find((view) => view.id === "tickets");
    expect(tickets?.body.kind === "kanban" ? tickets.body.rowActions : undefined).toContainEqual({
      id: "create-workspace",
      label: { $l10n: "kanbanRenderers.tickets.rowActions.createWorkspace", default: "Create workspace" },
      icon: "git-branch",
      command: { id: "create-workspace", kind: "command" },
    });
  });

  test("keeps tag and board rule settings separate from shared status fields", () => {
    expect(extension.settingsPanels?.map((panel) => panel.id)).toEqual(["ticket-tags", "ticket-board"]);
    expect(extension.settingsSections).toEqual([
      expect.objectContaining({ id: "planner", order: 40, title: expect.objectContaining({ default: "Planner" }) }),
    ]);
    expect(extension.statuses?.map((provider) => provider.id)).toEqual(["ticket-statuses"]);
  });
});

describe("pstdio planner notification hooks", () => {
  test("creates blocked notifications from session anchors when workspace anchors are empty", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedBacklogTicket(storage);
    const notifications: unknown[] = [];

    await hook("session-awaiting-input")?.run(
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
