import { describe, expect, mock, test } from "bun:test";
import {
  createNotificationFromWebview,
  dismissNotificationFromWebview,
  getNotificationDismissRequest,
} from "./extension-webview-frame";

describe("getNotificationDismissRequest", () => {
  test("accepts notification ids", () => {
    expect(getNotificationDismissRequest({ id: "notification-1" })).toEqual({ id: "notification-1" });
  });

  test("accepts notification dedupe keys", () => {
    expect(getNotificationDismissRequest({ dedupeKey: "proposal:PS-95" })).toEqual({ dedupeKey: "proposal:PS-95" });
  });

  test("rejects empty dismissal requests", () => {
    expect(() => getNotificationDismissRequest({})).toThrow("notification.dismiss requires an id or dedupeKey.");
  });

  test("dismisses dedupe-key requests with dismissed status", async () => {
    const apiClient = {
      notifications: {
        dismiss: mock(async () => undefined),
        resolveByDedupeKey: mock(async () => undefined),
      },
    };

    await dismissNotificationFromWebview(apiClient, "project-1", { dedupeKey: "proposal:PS-95" });

    expect(apiClient.notifications.resolveByDedupeKey).toHaveBeenCalledWith({
      projectId: "project-1",
      dedupeKey: "proposal:PS-95",
      status: "dismissed",
    });
    expect(apiClient.notifications.dismiss).not.toHaveBeenCalled();
  });
});

describe("createNotificationFromWebview", () => {
  test("routes creation through the owning extension endpoint", async () => {
    const create = mock(async () => undefined);

    await createNotificationFromWebview(create, {
      extensionId: "pstdio.pstdio-planner",
      projectId: "project-1",
      params: { title: "Blocked", kind: "blocked" },
    });

    expect(create).toHaveBeenCalledWith("project-1", "pstdio.pstdio-planner", { title: "Blocked", kind: "blocked" });
  });
});
