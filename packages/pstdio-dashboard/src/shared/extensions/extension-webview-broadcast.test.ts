import { describe, expect, test } from "bun:test";
import { publishExtensionCommandEvent, subscribeToExtensionEventFeed } from "./extension-webview-broadcast";

describe("extension event feed", () => {
  test("publishes unique emitted event ids from command responses and disposes subscriptions", () => {
    const received: string[] = [];
    const dispose = subscribeToExtensionEventFeed((eventId) => received.push(eventId));

    publishExtensionCommandEvent({
      commandId: "lab.update",
      extensionId: "pstdio.lab",
      eventIds: ["tickets.changed", "tickets.changed", "files.changed"],
      outcome: { ok: true, status: "success" },
    });

    expect(received).toEqual(["tickets.changed", "files.changed"]);

    dispose();
    publishExtensionCommandEvent({
      commandId: "lab.update",
      extensionId: "pstdio.lab",
      eventIds: ["tickets.changed"],
      outcome: { ok: true, status: "success" },
    });
    expect(received).toHaveLength(2);
  });
});
