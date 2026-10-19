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
        { level: "error", title: "Save failed", message: "Connection lost", inlineTarget: "region:main" },
      ]);
    });
  }

  test("keeps an asynchronous failure in the originating view after focus changes", async () => {
    let target = "settings";
    const notifications = createNotificationRegistry(() => target);
    let reject!: (error: Error) => void;
    const pending = runUserAction(
      { notifications },
      "Save",
      () =>
        new Promise((_resolve, rejectAction) => {
          reject = rejectAction;
        }),
    );
    target = "conversation";
    reject(new Error("Access denied"));
    await pending;
    expect(notifications.listNotifications()).toMatchObject([{ inlineTarget: "settings", message: "Access denied" }]);
  });

  test("retry clears only feedback for that action's view", async () => {
    const notifications = createNotificationRegistry(() => "settings");
    notifications.captureActionError("Save")(new Error("Access denied"));
    notifications.captureActionError("Rename", "files")(new Error("Name exists"));
    notifications.show({ id: "system", level: "error", title: "Extension crashed" });
    await runUserAction({ notifications }, "Save", () => undefined);
    expect(notifications.listNotifications()).toHaveLength(2);
    expect(notifications.listNotifications().map((notice) => notice.id)).not.toContain(
      "workbench.action-error.settings",
    );
  });
});
