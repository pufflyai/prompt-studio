import { describe, expect, test } from "bun:test";
import { publishExtensionCommandEvent, subscribeToExtensionEventFeed } from "./extension-webview-broadcast";

describe("extension event feed", () => {
  test("publishes unique emitted event ids from command responses and disposes subscriptions", () => {
    const received: unknown[] = [];
    const dispose = subscribeToExtensionEventFeed((event) => received.push(event));

    publishExtensionCommandEvent({
      commandId: "lab.update",
      extensionId: "pstdio.lab",
      eventIds: ["tickets.changed", "tickets.changed", "files.changed"],
      outcome: { ok: true, status: "success" },
    });

    expect(received).toEqual([{ id: "tickets.changed" }, { id: "files.changed" }]);

    dispose();
    publishExtensionCommandEvent({
      commandId: "lab.update",
      extensionId: "pstdio.lab",
      eventIds: ["tickets.changed"],
      outcome: { ok: true, status: "success" },
    });
    expect(received).toHaveLength(2);
  });

  test("adds host correlation to each published command event", () => {
    const received: unknown[] = [];
    const dispose = subscribeToExtensionEventFeed((event) => received.push(event));

    publishExtensionCommandEvent(
      {
        commandId: "planner.save-ticket-content",
        extensionId: "pstdio.planner",
        eventIds: ["tickets.changed"],
        outcome: { ok: true, status: "success" },
      },
      {
        resourceUri: "dashboard-workbench://ticket/ticket-1",
        origin: {
          rendererId: "planner.ticketContent",
          instanceId: "planner.ticketEditor:1",
          operationId: "save-1",
        },
        revision: "3",
      },
    );

    expect(received).toEqual([
      {
        id: "tickets.changed",
        resourceUri: "dashboard-workbench://ticket/ticket-1",
        origin: {
          rendererId: "planner.ticketContent",
          instanceId: "planner.ticketEditor:1",
          operationId: "save-1",
        },
        revision: "3",
      },
    ]);
    dispose();
  });
});
