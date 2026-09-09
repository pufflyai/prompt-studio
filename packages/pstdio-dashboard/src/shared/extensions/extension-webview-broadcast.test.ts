import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { publishExtensionCommandEvent, subscribeToExtensionEventFeed } from "./extension-webview-broadcast";

describe("extension event feed", () => {
  test("publishes unique emitted event ids from command responses and disposes subscriptions", () => {
    const received: unknown[] = [];
    const dispose = subscribeToExtensionEventFeed((event) => received.push(event));

    publishExtensionCommandEvent(
      {
        commandId: "lab.update",
        extensionId: "pstdio.lab",
        eventIds: ["tickets.changed", "tickets.changed", "files.changed"],
        outcome: { ok: true, status: "success" },
      },
      { projectId: undefined },
    );

    expect(received).toEqual([
      { id: "tickets.changed", projectId: undefined },
      { id: "files.changed", projectId: undefined },
    ]);

    dispose();
    publishExtensionCommandEvent(
      {
        commandId: "lab.update",
        extensionId: "pstdio.lab",
        eventIds: ["tickets.changed"],
        outcome: { ok: true, status: "success" },
      },
      { projectId: undefined },
    );
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
        projectId: "project-1",
        resourceKey: resourceKey({ type: "ticket", id: "ticket-1" }),
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
        projectId: "project-1",
        resourceKey: resourceKey({ type: "ticket", id: "ticket-1" }),
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
