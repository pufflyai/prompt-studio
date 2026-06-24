import { describe, expect, test } from "bun:test";
import { formatNotificationsTable, parseNotificationTarget, parseSnoozeUntil } from "./format";

describe("notification CLI formatting", () => {
  test("parses resource targets", () => {
    expect(parseNotificationTarget("ticket:PS-95")).toEqual({ type: "ticket", id: "PS-95", label: "PS-95" });
  });

  test("parses relative snooze deadlines", () => {
    expect(parseSnoozeUntil("2h", new Date("2026-01-01T10:00:00.000Z"))).toBe("2026-01-01T12:00:00.000Z");
  });

  test("formats a compact notification table", () => {
    expect(
      formatNotificationsTable([
        {
          id: "notification-1",
          projectId: "project-1",
          title: "Review proposal",
          body: null,
          kind: "needs_review",
          status: "open",
          priority: "high",
          source: "api",
          origin: "core",
          related: [],
          actions: [],
          createdAt: "2026-01-01T10:00:00.000Z",
          updatedAt: "2026-01-01T10:00:00.000Z",
        },
      ]),
    ).toContain("notification-1   high       open     needs_review   Review proposal");
  });
});
