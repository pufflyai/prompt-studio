import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-core-ticket-automations", () => {
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
