import { describe, expect, it } from "bun:test";
import { openTicketSessionBubble } from "./open-ticket-session-bubble";

describe("openTicketSessionBubble", () => {
  it("opens bubble when the modal is closed", () => {
    const events: string[] = [];

    const opened = openTicketSessionBubble({
      sessionId: "session-42",
      sessionModalState: "closed",
      setSessionModalState: (state) => events.push(`modal:${state}`),
      setSelectedSessionId: (sessionId) => events.push(`session:${sessionId}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual(["modal:bubble", "session:session-42"]);
  });

  it("selects a session without changing modal state by default", () => {
    const events: string[] = [];

    const opened = openTicketSessionBubble({
      sessionId: "session-42",
      setSessionModalState: (state) => events.push(`modal:${state}`),
      setSelectedSessionId: (sessionId) => events.push(`session:${sessionId}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual(["session:session-42"]);
  });

  it("keeps attached mode when selecting a session", () => {
    const events: string[] = [];

    const opened = openTicketSessionBubble({
      sessionId: "session-42",
      sessionModalState: "attached",
      setSessionModalState: (state) => events.push(`modal:${state}`),
      setSelectedSessionId: (sessionId) => events.push(`session:${sessionId}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual(["session:session-42"]);
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
