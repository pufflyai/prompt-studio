import { describe, expect, it } from "bun:test";
import { getSessionInterruptHandler } from "./session-chat-view-stop";

describe("SessionChatView stop action", () => {
  it("wires chat interrupt to stop the session", () => {
    const calls: string[] = [];
    const interrupt = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: false,
      onStopSession: (sessionId) => {
        calls.push(sessionId);
      },
    });

    expect(interrupt).toBeTypeOf("function");

    interrupt?.();

    expect(calls).toEqual(["session-1"]);
  });

  it("disables chat interrupt for non-active statuses", () => {
    const completedInterrupt = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "completed",
      isStopPending: false,
      hasRequestedStop: false,
      onStopSession: () => {},
    });

    const missingSessionInterrupt = getSessionInterruptHandler({
      sessionId: null,
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: false,
      onStopSession: () => {},
    });

    const pendingInterrupt = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: true,
      hasRequestedStop: false,
      onStopSession: () => {},
    });

    const requestedInterrupt = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: true,
      onStopSession: () => {},
    });

    expect(completedInterrupt).toBeUndefined();
    expect(missingSessionInterrupt).toBeUndefined();
    expect(pendingInterrupt).toBeUndefined();
    expect(requestedInterrupt).toBeUndefined();
  });

  it("does not own duplicate suppression", () => {
    const calls: string[] = [];
    const interrupt = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: false,
      onStopSession: (sessionId) => {
        calls.push(sessionId);
      },
    });

    interrupt?.();
    interrupt?.();

    expect(calls).toEqual(["session-1", "session-1"]);
  });

  it("allows retry after requested stop state is cleared", () => {
    const calls: string[] = [];
    let hasRequestedStop = false;

    const interruptBeforeRequest = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop,
      onStopSession: (sessionId) => {
        hasRequestedStop = true;
        calls.push(sessionId);
      },
    });

    interruptBeforeRequest?.();

    const interruptAfterRequest = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop,
      onStopSession: (sessionId) => {
        calls.push(sessionId);
      },
    });

    expect(interruptAfterRequest).toBeUndefined();
    expect(calls).toEqual(["session-1"]);

    hasRequestedStop = false;

    const interruptAfterFailedStop = getSessionInterruptHandler({
      sessionId: "session-1",
      sessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop,
      onStopSession: (sessionId) => {
        calls.push(sessionId);
      },
    });

    expect(interruptAfterFailedStop).toBeTypeOf("function");

    interruptAfterFailedStop?.();

    expect(calls).toEqual(["session-1", "session-1"]);
  });
});
