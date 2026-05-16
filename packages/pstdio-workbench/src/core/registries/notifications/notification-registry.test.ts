import { describe, expect, test } from "bun:test";
import { createNotificationRegistry } from "./notification-registry";

describe("createNotificationRegistry", () => {
  test("records command-backed workbench notifications with contribution metadata", () => {
    const notifications = createNotificationRegistry();
    const events: string[] = [];

    const subscription = notifications.subscribe((event) => {
      events.push(`${event.type}:${event.id}`);
    });

    const notification = notifications.show(
      {
        id: "registry-sync",
        level: "warning",
        title: "Registry sync failed",
        message: "Three resources could not be indexed.",
        createdAt: "2026-05-13T10:08:00.000Z",
        actions: [{ commandId: "diagnostics.open", title: "Open diagnostics" }],
      },
      { source: "module", ownerId: "prompt-studio.project" },
    );

    expect(notification).toMatchObject({
      id: "registry-sync",
      source: "module",
      ownerId: "prompt-studio.project",
      actions: [{ commandId: "diagnostics.open", title: "Open diagnostics" }],
    });
    expect(notifications.listNotifications()).toEqual([notification]);

    notifications.dismiss("registry-sync");
    subscription.dispose();

    expect(notifications.listNotifications()).toEqual([]);
    expect(events).toEqual(["show:registry-sync", "dismiss:registry-sync"]);
  });
});
