import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../../core/workbench-core";

describe("file renderer refresh events", () => {
  test("preserves optional resource, origin, and revision context", () => {
    const workbench = createWorkbenchCore();
    workbench.renderers.registerFileRenderer({
      id: "planner.ticketContent",
      title: "Ticket",
      load: () => ({ content: "" }),
    });
    const received: unknown[] = [];
    workbench.renderers.onDidRefreshFileRenderer((event) => received.push(event));

    workbench.renderers.refreshFileRenderer("planner.ticketContent", {
      resourceUri: "dashboard-workbench://ticket/ticket-1",
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
        resourceUri: "dashboard-workbench://ticket/ticket-1",
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
