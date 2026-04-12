import { describe, expect, it } from "bun:test";
import { buildSessionOverflowActions } from "./sessions-panel-actions";

describe("SessionsPanel actions", () => {
  it("shows stop action only for active statuses", () => {
    const translate = (value: string) => value;
    const onStopSession = () => {};
    const onArchiveSession = () => {};

    const inProgressActions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: false,
      t: translate,
      onStopSession,
      onArchiveSession,
    });
    const awaitingInputActions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "awaiting_input",
      isStopPending: false,
      hasRequestedStop: false,
      t: translate,
      onStopSession,
      onArchiveSession,
    });
    const completedActions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "completed",
      isStopPending: false,
      hasRequestedStop: false,
      t: translate,
      onStopSession,
      onArchiveSession,
    });
    const failedActions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "failed",
      isStopPending: false,
      hasRequestedStop: false,
      t: translate,
      onStopSession,
      onArchiveSession,
    });

    expect(inProgressActions.some((action) => action.key === "stop-session")).toBe(true);
    expect(awaitingInputActions.some((action) => action.key === "stop-session")).toBe(true);
    expect(completedActions.some((action) => action.key === "stop-session")).toBe(false);
    expect(failedActions.some((action) => action.key === "stop-session")).toBe(false);
  });

  it("wires stop action to stop mutation and keeps archive action", () => {
    const calls: string[] = [];
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: false,
      t: (value) => value,
      onStopSession: () => {
        calls.push("stop");
      },
      onArchiveSession: () => {
        calls.push("archive");
      },
    });

    const stopAction = actions.find((action) => action.key === "stop-session");
    const archiveAction = actions.find((action) => action.key === "archive-session");

    expect(stopAction).toBeDefined();
    expect(archiveAction).toBeDefined();

    stopAction?.onClick();
    archiveAction?.onClick();

    expect(calls).toEqual(["stop", "archive"]);
  });

  it("does not own duplicate suppression", () => {
    const calls: string[] = [];
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop: false,
      t: (value) => value,
      onStopSession: () => {
        calls.push("stop");
      },
      onArchiveSession: () => {},
    });

    const stopAction = actions.find((action) => action.key === "stop-session");

    stopAction?.onClick();
    stopAction?.onClick();

    expect(calls).toEqual(["stop", "stop"]);
  });

  it("disables stop action while stop mutation is pending", () => {
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: true,
      hasRequestedStop: false,
      t: (value) => value,
      onStopSession: () => {},
      onArchiveSession: () => {},
    });

    const stopAction = actions.find((action) => action.key === "stop-session");

    expect(stopAction?.isDisabled).toBe(true);
  });

  it("allows retry after requested stop state is cleared", () => {
    const calls: string[] = [];
    let hasRequestedStop = false;

    const actionsBeforeRequest = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop,
      t: (value) => value,
      onStopSession: () => {
        hasRequestedStop = true;
        calls.push("stop");
      },
      onArchiveSession: () => {},
    });

    const stopActionBeforeRequest = actionsBeforeRequest.find((action) => action.key === "stop-session");
    stopActionBeforeRequest?.onClick();

    const actionsAfterRequest = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop,
      t: (value) => value,
      onStopSession: () => {
        calls.push("stop");
      },
      onArchiveSession: () => {},
    });

    const stopActionAfterRequest = actionsAfterRequest.find((action) => action.key === "stop-session");

    expect(stopActionAfterRequest?.isDisabled).toBe(true);

    stopActionAfterRequest?.onClick();

    expect(calls).toEqual(["stop"]);

    hasRequestedStop = false;

    const actionsAfterFailedStop = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isStopPending: false,
      hasRequestedStop,
      t: (value) => value,
      onStopSession: () => {
        calls.push("stop");
      },
      onArchiveSession: () => {},
    });

    const stopActionAfterFailedStop = actionsAfterFailedStop.find((action) => action.key === "stop-session");

    expect(stopActionAfterFailedStop?.isDisabled).toBe(false);

    stopActionAfterFailedStop?.onClick();

    expect(calls).toEqual(["stop", "stop"]);
  });
});
