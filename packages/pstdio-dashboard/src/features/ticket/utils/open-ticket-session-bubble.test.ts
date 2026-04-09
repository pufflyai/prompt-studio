import { describe, expect, it } from "bun:test";
import { openTicketSessionBubble } from "./open-ticket-session-bubble";

describe("openTicketSessionBubble", () => {
  it("selects a session without forcing bubble by default", () => {
    const events: string[] = [];

    const opened = openTicketSessionBubble({
      sessionId: "session-42",
      setSessionModalState: (state) => events.push(`modal:${state}`),
      setSelectedSessionId: (sessionId) => events.push(`session:${sessionId}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual(["session:session-42"]);
  });

  it("opens the bubble and selects the session when a session id is provided", () => {
    const events: string[] = [];

    const opened = openTicketSessionBubble({
      sessionId: "session-42",
      forceBubble: true,
      setSessionModalState: (state) => events.push(`modal:${state}`),
      setSelectedSessionId: (sessionId) => events.push(`session:${sessionId}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual(["modal:bubble", "session:session-42"]);
  });

  it("does nothing when session id is missing", () => {
    const events: string[] = [];

    const opened = openTicketSessionBubble({
      sessionId: null,
      setSessionModalState: (state) => events.push(`modal:${state}`),
      setSelectedSessionId: (sessionId) => events.push(`session:${sessionId}`),
    });

    expect(opened).toBe(false);
    expect(events).toEqual([]);
  });
});
