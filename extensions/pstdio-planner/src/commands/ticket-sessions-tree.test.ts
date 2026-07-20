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

    const section = buildSessionsSection(sessions, "ticket-1");

    expect(section?.id).toBe("sessions");
    expect(section?.nodes.map((node) => node.id)).toEqual(["session-a"]);
  });

  test("orders sessions by most recent activity first", () => {
    const sessions = [
      session({ id: "old", anchors_json: [ticketAnchor("ticket-1")], last_request_ended: "2026-01-01T00:00:00.000Z" }),
      session({ id: "new", anchors_json: [ticketAnchor("ticket-1")], last_request_ended: "2026-02-01T00:00:00.000Z" }),
    ];

    const section = buildSessionsSection(sessions, "ticket-1");

    expect(section?.nodes.map((node) => node.id)).toEqual(["session-new", "session-old"]);
  });

  test("returns an empty row when the ticket has no sessions", () => {
    const section = buildSessionsSection([session({ id: "a", anchors_json: [ticketAnchor("other")] })], "ticket-1");

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

    const node = buildSessionsSection(sessions, "ticket-1")?.nodes[0];

    expect(node?.target).toEqual({
      kind: "resource",
      resource: { type: "session", id: "a", label: "Refine ticket: PS-1", metadata: { sessionSurface: "side" } },
    });
  });
});
