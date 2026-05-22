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
});
