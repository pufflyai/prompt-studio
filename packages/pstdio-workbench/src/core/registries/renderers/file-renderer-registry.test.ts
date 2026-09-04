import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../../core/workbench-core";
import { getWorkbenchRenderers } from "../../../core/workbench-renderers";

describe("file renderer refresh events", () => {
  test("preserves optional resource, origin, and revision context", () => {
    const workbench = createWorkbench();
    getWorkbenchRenderers(workbench).registerFileRenderer({
      id: "planner.ticketContent",
      title: "Ticket",
      load: () => ({ content: "" }),
    });
    const received: unknown[] = [];
    getWorkbenchRenderers(workbench).onDidRefreshFileRenderer((event) => received.push(event));

    getWorkbenchRenderers(workbench).refreshFileRenderer("planner.ticketContent", {
      resourceUri: "pstdio://extension-resource/ticket/ticket-1",
      origin: {
        rendererId: "planner.ticketContent",
        instanceId: "planner.ticketEditor:1",
        operationId: "save-1",
      },
      revision: "3",
    });

    expect(received).toEqual([
      {
        fileRendererId: "planner.ticketContent",
        resourceUri: "pstdio://extension-resource/ticket/ticket-1",
        origin: {
          rendererId: "planner.ticketContent",
          instanceId: "planner.ticketEditor:1",
          operationId: "save-1",
        },
        revision: "3",
      },
    ]);
  });
});
