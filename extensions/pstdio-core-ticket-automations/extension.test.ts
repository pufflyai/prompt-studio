import { describe, expect, test } from "bun:test";
import extension from "./extension";

const ticketCliPaths = () =>
  Object.values(extension.commands ?? {})
    .map((command) => (typeof command.cli === "object" ? command.cli.path?.join(" ") : null))
    .filter((path): path is string => Boolean(path));

describe("pstdio-core-ticket-automations setup and surfaces", () => {
  test("seeds ticket workflow statuses during setup", async () => {
    const createdTicketStatuses: unknown[] = [];
    const createdAttemptStatuses: unknown[] = [];

    await extension.initialSetup?.({
      ticketStatuses: {
        list: async () => [],
        create: async (input: unknown) => {
          createdTicketStatuses.push(input);
          return { id: `ticket-status-${createdTicketStatuses.length}`, ...(input as object) };
        },
        update: async () => ({ id: "updated" }),
        setDefault: async () => {},
      },
      attemptStatuses: {
        list: async () => [],
        create: async (input: unknown) => {
          createdAttemptStatuses.push(input);
          return { id: `attempt-status-${createdAttemptStatuses.length}`, ...(input as object) };
        },
        update: async () => ({ id: "updated" }),
        delete: async () => {},
      },
    } as never);

    expect(createdTicketStatuses).toEqual([
      expect.objectContaining({ name: "backlog", color: "gray", isDefault: true, canCreate: true }),
      expect.objectContaining({ name: "ready", color: "green" }),
      expect.objectContaining({ name: "wip", color: "blue" }),
      expect.objectContaining({ name: "blocked", color: "red" }),
      expect.objectContaining({ name: "review", color: "amber" }),
      expect.objectContaining({ name: "done", color: "green", columnActions: ["archive_all"] }),
    ]);
    expect(createdAttemptStatuses.map((status) => (status as { name: string }).name)).toEqual([
      "wip",
      "blocked",
      "review-ready",
      "reviewed",
      "changes-requested",
    ]);
  });

  test("contributes a project settings panel for ticket statuses", () => {
    const panel = extension.settingsPanels?.ticketStatuses;

    expect(panel).toMatchObject({
      title: "Ticket statuses",
      slot: expect.objectContaining({ id: "project.settingsPanels" }),
      webview: expect.objectContaining({
        capabilities: ["commands.execute"],
      }),
    });
  });

  test("contributes a ticket automation panel in the project sidebar", () => {
    expect(extension.routes?.ticketAutomation).toMatchObject({
      label: "Ticket automation",
      path: "ticket-automation",
      webview: expect.objectContaining({
        capabilities: ["commands.execute"],
      }),
    });
    expect(extension.navigation?.ticketAutomation).toMatchObject({
      icon: "Ticket",
      label: "Ticket automation",
      route: "ticket-automation",
      slot: expect.objectContaining({ id: "project.sidebarNav" }),
    });
  });
});

describe("pstdio-core-ticket-automations ticket CLI commands", () => {
  test("covers every built-in ticket CLI command with extension CLI commands", () => {
    expect(ticketCliPaths().sort()).toEqual([
      "tickets archive",
      "tickets create",
      "tickets delete",
      "tickets files",
      "tickets implement",
      "tickets list",
      "tickets pull",
      "tickets save",
      "tickets update",
      "tickets update-when-attempt-status",
      "tickets view",
      "tickets workspaces",
      "tickets worktrees list",
      "tickets worktrees remove-all",
      "tickets write",
    ]);
  });

  test("ticket CLI commands delegate to pstdio tickets with kebab-case flags", async () => {
    const calls: unknown[] = [];
    const command = extension.commands?.["tickets.update"];
    if (!command) throw new Error("Expected tickets.update command to exist.");

    await command.run({
      params: {
        clearParent: true,
        id: "PS-304",
        status: "wip",
        tag: ["bug", "urgent"],
      },
      projectId: "project-1",
      process: {
        runOrThrow: async (input: unknown) => {
          calls.push(input);
          return { exitCode: 0, stdout: "Updated ticket PS-304\n", stderr: "" };
        },
      },
      repos: {
        getDefault: async () => ({ path: "/repo" }),
      },
    } as never);

    expect(calls).toEqual([
      {
        command: [
          "pstdio",
          "tickets",
          "update",
          "--project-id",
          "project-1",
          "--id",
          "PS-304",
          "--status",
          "wip",
          "--no-parent-id",
          "--tag",
          "bug",
          "--tag",
          "urgent",
        ],
        cwd: "/repo",
      },
    ]);
  });
});

describe("pstdio-core-ticket-automations status commands", () => {
  test("ticketStatus.read returns ticket statuses from the host", async () => {
    const statuses = [
      {
        id: "status-done",
        name: "done",
        color: "green",
        sortOrder: 60,
        isDefault: false,
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: ["archive_all"],
      },
    ];

    const result = await extension.commands?.["ticketStatus.read"]?.run({
      params: {},
      ticketStatuses: {
        list: async () => statuses,
      },
    } as never);

    expect(result).toEqual({ statuses });
  });

  test("ticketStatus.update persists column action controls", async () => {
    const updates: unknown[] = [];

    await extension.commands?.["ticketStatus.update"]?.run({
      params: {
        statusId: "status-done",
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: ["archive_all"],
      },
      ticketStatuses: {
        update: async (input: unknown) => {
          updates.push(input);
          return { id: "status-done" };
        },
      },
    } as never);

    expect(updates).toEqual([
      {
        statusId: "status-done",
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: ["archive_all"],
      },
    ]);
  });
});

describe("pstdio-core-ticket-automations ticket actions", () => {
  test("mounts ticket-scoped actions in ticket header slots", () => {
    expect(extension.commands?.runAttempt?.menus).toEqual([
      { slot: expect.any(Object), label: "Run attempt", icon: "play", presentation: "button" },
    ]);
    expect(extension.commands?.runAttempt?.menus?.[0]?.slot.id).toBe("ticket.headerPrimary");
    expect(extension.commands?.refineTicket?.menus?.[0]?.slot.id).toBe("ticket.headerOverflow");
    expect(extension.commands?.breakIntoSubTickets?.menus?.[0]?.slot.id).toBe("ticket.headerOverflow");
  });

  test("runAttempt uses the ticket resource when launched from the dashboard", async () => {
    const attempts: unknown[] = [];

    await extension.commands?.runAttempt?.run({
      params: {},
      resource: { type: "ticket", id: "ticket-1", label: "PS-304" },
      tickets: {
        createAttempt: async (input: unknown) => {
          attempts.push(input);
        },
      },
    } as never);

    expect(attempts).toEqual([
      {
        ticket: "PS-304",
        agent: undefined,
        model: undefined,
        repoId: undefined,
        branch: undefined,
        prompt: "Implement ticket: PS-304",
      },
    ]);
  });

  test("refineTicket uses the ticket resource when launched from the dashboard", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.refineTicket?.run({
      params: {},
      resource: { type: "ticket", id: "ticket-1", label: "PS-304" },
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
        harness: undefined,
        prompt: "Refine ticket: PS-304",
      },
    ]);
  });

  test("review-ready saves local ticket state before starting review", async () => {
    const calls: unknown[] = [];

    await extension.hooks?.attemptStatusChanged?.handler(
      {
        process: {
          runOrThrow: async (input: unknown) => {
            calls.push({ type: "process", input });
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
        sessions: {
          create: async (input: unknown) => {
            calls.push({ type: "session", input });
            return { id: "session-1" };
          },
        },
      } as never,
      {
        projectId: "project-1",
        workspaceId: "workspace-1",
        ticket: { id: "ticket-1", shorthand: "PS-304" },
        workspace: { id: "workspace-1" },
        fromStatus: "wip",
        toStatus: "review-ready",
        sessionId: "session-1",
        originalSessionId: null,
        worktreePath: "/repo/.pstdio-worktrees/PS-304_A1",
      } as never,
    );

    expect(calls).toEqual([
      {
        type: "process",
        input: {
          command: ["pstdio", "tickets", "save", "--id", "PS-304"],
          cwd: "/repo/.pstdio-worktrees/PS-304_A1",
        },
      },
      {
        type: "session",
        input: {
          workspaceId: "workspace-1",
          title: "Code review: PS-304",
          template: "review-code",
          vars: { ticket: "PS-304" },
          originalSessionId: "session-1",
        },
      },
    ]);
  });
});
