import { describe, expect, test } from "bun:test";
import { buildSessionsSection, type TicketSession } from "./ticket-sessions-tree";

const session = (overrides: Partial<TicketSession> & { id: string }): TicketSession => ({
  title: `Session ${overrides.id}`,
  status: "in_progress",
  ...overrides,
});

const ticketAnchor = (ticketId: string) => ({ type: "ticket", id: ticketId });

describe("buildSessionsSection", () => {
  test("lists only sessions anchored to the ticket", () => {
    const sessions = [
      session({ id: "a", title: "Refine ticket: PS-1", anchors_json: [ticketAnchor("ticket-1")] }),
      session({ id: "b", title: "Refine ticket: PS-2", anchors_json: [ticketAnchor("ticket-2")] }),
      session({ id: "c", title: "Unanchored" }),
    ];

    const section = buildSessionsSection({ sessions, ticketId: "ticket-1" });

    expect(section?.id).toBe("sessions");
    expect(section?.nodes.map((node) => node.id)).toEqual(["session-a"]);
  });

  test("orders sessions by most recent activity first", () => {
    const sessions = [
      session({ id: "old", anchors_json: [ticketAnchor("ticket-1")], last_request_ended: "2026-01-01T00:00:00.000Z" }),
      session({ id: "new", anchors_json: [ticketAnchor("ticket-1")], last_request_ended: "2026-02-01T00:00:00.000Z" }),
    ];

    const section = buildSessionsSection({ sessions, ticketId: "ticket-1" });

    expect(section?.nodes.map((node) => node.id)).toEqual(["session-new", "session-old"]);
  });

  test("includes the sessions of every workspace linked to the ticket", () => {
    const sessions = [
      session({ id: "refine", anchors_json: [ticketAnchor("ticket-1")], updated_at: "2026-01-02T00:00:00.000Z" }),
    ];
    const workspaceSessions = [
      session({ id: "attempt-1", updated_at: "2026-01-03T00:00:00.000Z" }),
      session({ id: "attempt-2", updated_at: "2026-01-01T00:00:00.000Z" }),
    ];

    const section = buildSessionsSection({ sessions, ticketId: "ticket-1", workspaceSessions });

    expect(section?.nodes.map((node) => node.id)).toEqual(["session-attempt-1", "session-refine", "session-attempt-2"]);
  });

  test("lists a session anchored to the ticket and run in its workspace only once", () => {
    const shared = session({ id: "shared", anchors_json: [ticketAnchor("ticket-1")] });

    const section = buildSessionsSection({ sessions: [shared], ticketId: "ticket-1", workspaceSessions: [shared] });

    expect(section?.nodes.map((node) => node.id)).toEqual(["session-shared"]);
  });

  test("returns an empty row when the ticket has no sessions", () => {
    const section = buildSessionsSection({
      sessions: [session({ id: "a", anchors_json: [ticketAnchor("other")] })],
      ticketId: "ticket-1",
    });

    expect(section).toEqual({
      id: "sessions",
      label: "Sessions",
      collapsible: true,
      nodes: [
        {
          id: "sessions-empty",
          label: "No sessions",
          icon: "MessageCircle",
          disabled: true,
          rowVariant: "empty-state",
        },
      ],
    });
  });

  test("opens each session in the Side Panel via a hinted session resource", () => {
    const sessions = [session({ id: "a", title: "Refine ticket: PS-1", anchors_json: [ticketAnchor("ticket-1")] })];

    const node = buildSessionsSection({ sessions, ticketId: "ticket-1" })?.nodes[0];

    expect(node?.target).toEqual({
      kind: "resource",
      resource: { type: "session", id: "a", label: "Refine ticket: PS-1", metadata: { sessionSurface: "side" } },
    });
  });
});
