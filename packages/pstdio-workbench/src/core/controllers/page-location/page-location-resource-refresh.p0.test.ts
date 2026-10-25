import { expect, test } from "bun:test";
import { createPageLocationHarness, ticketTarget, workspaceRef } from "./page-location-controller.test-support";
import type { WorkbenchPageHistoryState } from "./page-location-types";

test("different documents on one resource retain distinct history and restore from URLs", () => {
  const harness = createPageLocationHarness();
  harness.controller.boot("p1");
  const select = (path: string, label?: string) =>
    harness.controller.navigate({
      kind: "page",
      page: workspaceRef,
      resource: { type: "workspace", id: "WS-4", label, metadata: { workspaceFilePath: path } },
    });
  select("src/a.ts");
  const first = harness.browser.current();
  const count = harness.browser.pushes.length;
  select("src/b.ts");
  expect(harness.browser.pushes.length).toBe(count + 1);
  const second = harness.browser.current();
  select("src/b.ts", "Refreshed workspace");
  expect(harness.browser.pushes.length).toBe(count + 1);
  harness.browser.pop({ ...first, state: undefined });
  expect(harness.registry.store.getState().location?.resource?.metadata?.workspaceFilePath).toBe("src/a.ts");
  harness.browser.pop(second);
  expect(harness.registry.store.getState().location?.resource?.metadata?.workspaceFilePath).toBe("src/b.ts");
});

test("a resource refresh updates the new history entry and preserves the previous page", () => {
  const harness = createPageLocationHarness();
  harness.controller.boot("p1");
  harness.controller.navigate(ticketTarget());
  const ticketEntry = harness.browser.current();
  const replacementsBefore = harness.browser.replacements.length;
  const unsubscribe = harness.registry.store.subscribe(({ location }) => {
    if (location?.resource?.type !== "workspace" || location.resource.label) return;
    harness.controller.replay({ ...location, resource: { ...location.resource, label: "My workspace" } });
  });

  harness.controller.navigate({
    kind: "page",
    page: workspaceRef,
    resource: { type: "workspace", id: "WS-4" },
    parent: ticketTarget(),
  });
  unsubscribe();

  const workspaceEntry = harness.browser.pushes.at(-1)!;
  expect(harness.browser.replacements.slice(replacementsBefore)).toEqual([
    {
      ...workspaceEntry,
      state: {
        ...(workspaceEntry.state as WorkbenchPageHistoryState),
        location: harness.registry.store.getState().location,
      },
    },
  ]);
  expect(harness.browser.current()).toEqual(harness.browser.replacements.at(-1)!);
  expect(harness.persistence.values.get("p1")?.location.resource?.label).toBe("My workspace");

  harness.browser.pop(ticketEntry);
  expect(harness.registry.store.getState().location?.resource?.id).toBe("PS-326");
});

test("source position activation preserves file identity and refresh preserves the presentation request", () => {
  const harness = createPageLocationHarness();
  harness.controller.boot("p1");
  const target = {
    kind: "page" as const,
    page: workspaceRef,
    resource: { type: "workspace", id: "WS-4", metadata: { workspaceFilePath: "src/a.ts" } },
    position: { line: 3, column: 2 },
  };
  harness.controller.navigate(target);
  const first = harness.registry.store.getState().location!;
  const pushes = harness.browser.pushes.length;
  harness.controller.navigate({ ...target, position: { column: 2, line: 3 } });
  const activated = harness.registry.store.getState().location!;
  expect(harness.browser.pushes.length).toBe(pushes);
  expect(activated.position).toEqual(first.position);
  expect(activated.position).not.toBe(first.position);
  harness.controller.replay({ ...activated, resource: { ...activated.resource!, label: "Refreshed workspace" } });
  expect(harness.registry.store.getState().location!.position).toBe(activated.position);
  harness.controller.navigate({ ...target, position: { line: 12 } });
  expect(harness.browser.pushes.length).toBe(pushes + 1);
  expect(harness.registry.store.getState().location!.resource?.id).toBe("WS-4");
});
