import { describe, expect, it } from "bun:test";
import { autoStartRefineSession } from "./auto-start-refine-session";

describe("autoStartRefineSession", () => {
  it("starts a refine session with the selected template and opens the bubble", async () => {
    const prompts: string[] = [];
    const openedSessionIds: Array<string | null> = [];

    const opened = await autoStartRefineSession({
      ticketShorthand: "PS-45",
      templateName: "proposal",
      startSession: async (prompt) => {
        prompts.push(prompt);
        return "session-99";
      },
      openSessionBubble: (sessionId) => {
        openedSessionIds.push(sessionId);
        return true;
      },
    });

    expect(prompts).toEqual(["refine ticket: PS-45 with template proposal"]);
    expect(openedSessionIds).toEqual(["session-99"]);
    expect(opened).toBe(true);
  });

  it("does nothing when no template is selected", async () => {
    let startCalls = 0;
    let openCalls = 0;

    const opened = await autoStartRefineSession({
      ticketShorthand: "PS-45",
      templateName: null,
      startSession: async () => {
        startCalls += 1;
        return "session-99";
      },
      openSessionBubble: () => {
        openCalls += 1;
        return true;
      },
    });

    expect(startCalls).toBe(0);
    expect(openCalls).toBe(0);
    expect(opened).toBe(false);
  });

  it("returns false when session creation returns null", async () => {
    const openedSessionIds: Array<string | null> = [];

    const opened = await autoStartRefineSession({
      ticketShorthand: "PS-45",
      templateName: "proposal",
      startSession: async () => null,
      openSessionBubble: (sessionId) => {
        openedSessionIds.push(sessionId);
        return false;
      },
    });

    expect(openedSessionIds).toEqual([null]);
    expect(opened).toBe(false);
  });
});
