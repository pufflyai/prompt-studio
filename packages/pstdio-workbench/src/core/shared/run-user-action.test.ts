import { describe, expect, test } from "bun:test";
import { createNotificationRegistry } from "../registries/notifications/notification-registry";
import { runUserAction } from "./run-user-action";

describe("user action failure reporting", () => {
  test("successful actions do not report a failure", async () => {
    const notifications = createNotificationRegistry();
    let ran = false;
    await runUserAction({ notifications }, "Save", () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(notifications.listNotifications()).toEqual([]);
  });
  for (const asynchronous of [false, true]) {
    test(`reports one ${asynchronous ? "asynchronous" : "synchronous"} failure and consumes it`, async () => {
      const notifications = createNotificationRegistry();
      await runUserAction({ notifications }, "Save", () => {
        const error = new Error("Connection lost");
        if (asynchronous) return Promise.reject(error);
        throw error;
      });
      expect(notifications.listNotifications()).toMatchObject([
        { level: "error", title: "Save failed", message: "Connection lost" },
      ]);
    });
  }
});
