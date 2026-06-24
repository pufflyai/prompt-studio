import { afterEach, describe, expect, test } from "bun:test";
import type { Notification } from "pstdio-api-contracts";
import { getWriter } from "@/lib/sync/collections";
import { readNotificationItems } from "./notifications-data";

const createNotification = (id: string, status: Notification["status"]): Notification => ({
  id,
  projectId: "project-1",
  title: id,
  body: null,
  kind: "info",
  status,
  priority: "normal",
  source: "api",
  origin: "core",
  sourceExtensionId: null,
  actorType: null,
  actorId: null,
  target: null,
  related: [],
  actions: [],
  dedupeKey: null,
  metadata: null,
  createdAt: "2026-06-24T10:00:00.000Z",
  updatedAt: `2026-06-24T10:00:0${id}.000Z`,
  readAt: null,
  resolvedAt: status === "done" ? "2026-06-24T10:00:10.000Z" : null,
  snoozedUntil: status === "snoozed" ? "2026-06-25T10:00:00.000Z" : null,
  expiresAt: null,
});

describe("readNotificationItems", () => {
  afterEach(() => {
    getWriter("notifications")?.truncateAndWrite([]);
  });

  test("defaults to open and read notifications only", () => {
    getWriter("notifications")?.truncateAndWrite([
      createNotification("1", "open"),
      createNotification("2", "read"),
      createNotification("3", "snoozed"),
      createNotification("4", "done"),
    ]);

    expect(readNotificationItems("project-1").map((item) => item.status)).toEqual(["read", "open"]);
  });

  test("supports snoozed, done, and all inbox filters", () => {
    getWriter("notifications")?.truncateAndWrite([
      createNotification("1", "open"),
      createNotification("2", "snoozed"),
      createNotification("3", "done"),
      createNotification("4", "dismissed"),
    ]);

    expect(readNotificationItems("project-1", "snoozed").map((item) => item.status)).toEqual(["snoozed"]);
    expect(readNotificationItems("project-1", "done").map((item) => item.status)).toEqual(["dismissed", "done"]);
    expect(readNotificationItems("project-1", "all").map((item) => item.status)).toEqual([
      "dismissed",
      "done",
      "snoozed",
      "open",
    ]);
  });
});
