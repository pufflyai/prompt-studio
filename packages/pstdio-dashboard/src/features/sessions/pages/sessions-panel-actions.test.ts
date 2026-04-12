import { describe, expect, it, mock } from "bun:test";
import { buildSessionOverflowActions, canStopSession } from "./sessions-panel-actions";

describe("canStopSession", () => {
  it("returns true for in-progress statuses", () => {
    expect(canStopSession("in_progress")).toBe(true);
    expect(canStopSession("awaiting_input")).toBe(true);
  });

  it("returns false for terminal statuses", () => {
    expect(canStopSession("completed")).toBe(false);
    expect(canStopSession("failed")).toBe(false);
    expect(canStopSession("cancelled")).toBe(false);
  });
});

describe("buildSessionOverflowActions", () => {
  it("includes stop before archive for active sessions", () => {
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "in_progress",
      isSelectedSessionArchived: false,
      labels: {
        stopSession: "Stop session",
        archiveSession: "Archive session",
      },
      onStopSession: () => {},
      onArchiveSession: () => {},
    });

    expect(actions.map((action) => action.key)).toEqual(["stop-session", "archive-session"]);
  });

  it("keeps archive action for terminal sessions", () => {
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "completed",
      isSelectedSessionArchived: false,
      labels: {
        stopSession: "Stop session",
        archiveSession: "Archive session",
      },
      onStopSession: () => {},
      onArchiveSession: () => {},
    });

    expect(actions.map((action) => action.key)).toEqual(["archive-session"]);
  });

  it("triggers stop callback with the selected session id", () => {
    const stopSession = mock(() => {});

    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "awaiting_input",
      isSelectedSessionArchived: false,
      labels: {
        stopSession: "Stop session",
        archiveSession: "Archive session",
      },
      onStopSession: stopSession,
      onArchiveSession: () => {},
    });

    const stopAction = actions.find((action) => action.key === "stop-session");
    stopAction?.onClick();

    expect(stopSession).toHaveBeenCalledTimes(1);
    expect(stopSession).toHaveBeenCalledWith("session-1");
  });

  it("hides stop for archived sessions even when status is active", () => {
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "awaiting_input",
      isSelectedSessionArchived: true,
      labels: {
        stopSession: "Stop session",
        archiveSession: "Archive session",
      },
      onStopSession: () => {},
      onArchiveSession: () => {},
    });

    expect(actions.map((action) => action.key)).toEqual(["archive-session"]);
  });

  it("hides stop while archived state is unknown", () => {
    const actions = buildSessionOverflowActions({
      selectedSessionId: "session-1",
      selectedSessionStatus: "awaiting_input",
      isSelectedSessionArchived: null,
      labels: {
        stopSession: "Stop session",
        archiveSession: "Archive session",
      },
      onStopSession: () => {},
      onArchiveSession: () => {},
    });

    expect(actions.map((action) => action.key)).toEqual(["archive-session"]);
  });
});
