import { describe, expect, test } from "bun:test";
import { resolveDashboardSessionView } from "./dashboard-sessions";

describe("resolveDashboardSessionView", () => {
  test("keeps an opened session addressable before synced rows arrive", () => {
    const view = resolveDashboardSessionView("session-created-from-draft");

    expect(view.id).toBe("session-created-from-draft");
    expect(view.sessionId).toBe("session-created-from-draft");
  });
});
