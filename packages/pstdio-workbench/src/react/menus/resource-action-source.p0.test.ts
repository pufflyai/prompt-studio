import { expect, test } from "bun:test";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import {
  createResourceViewerFixture,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { createWorkbenchWebviewHostCapabilities } from "../../extensions/bridge/webview-host-capabilities";
import { createResourceActionSource } from "./resource-action-source";

test("native action snapshots follow guest registration, completion, and disconnect", async () => {
  const f = createResourceViewerFixture({ tabs: true });
  await f.openMain("x");
  const placement = f.w.layout.getActivePanel("main")!;
  const events = createHostEventPublisher();
  const messages: unknown[] = [];
  events.bind((message) => messages.push(message.payload));
  const capabilities = createWorkbenchWebviewHostCapabilities({
    workbench: f.w,
    placement,
    extensionId: "example.readers",
    projectId: "project",
    hostEvents: events,
  });
  const source = createResourceActionSource(f.w, viewerResource("x"), {
    projectId: "project",
    placement: placement.placementIdentity,
  });
  expect(source.getSnapshot()).toEqual([]);
  let changes = 0;
  const stop = source.subscribe(() => {
    changes++;
  });
  try {
    await capabilities["resources.actions.register"]({
      operation: "register",
      registrationId: crypto.randomUUID(),
      resource: viewerResource("x"),
      label: "Export SVG",
    });
    await capabilities["resources.actions.register"]({
      operation: "register",
      registrationId: crypto.randomUUID(),
      resource: viewerResource("x"),
      label: "Inspect source",
    });
    const labels = () => source.getSnapshot().map((action) => action.label);
    expect(changes).toBeGreaterThan(0);
    expect(labels()).toEqual(["Export SVG", "Inspect source"]);
    source.getSnapshot()[0].onClick?.();
    const event = messages.at(-1) as { type: string; requestId: string };
    expect(event.type).toBe("execute");

    // Observe the busy action after a context change while the guest is still running.
    f.w.context.set("workbench.resource.type", "viewer");
    expect(labels()).toEqual(["Export SVG", "Inspect source"]);
    expect(source.getSnapshot()[0].isDisabled).toBe(true);
    const changesDuringAction = changes;
    await capabilities["resources.actions.register"]({ operation: "complete", requestId: event.requestId });
    expect(labels()).toEqual(["Export SVG", "Inspect source"]);
    expect(source.getSnapshot()[0].isDisabled).toBe(false);
    expect(changes).toBeGreaterThan(changesDuringAction);

    events.unbind();
    expect(source.getSnapshot()).toEqual([]);
  } finally {
    stop();
    events.unbind();
  }
});
