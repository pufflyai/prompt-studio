import { expect, test } from "bun:test";
import { createPageLocationHarness, ticketTarget, workspaceRef } from "./page-location-controller.test-support";
import type { WorkbenchPageHistoryState } from "./page-location-types";

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
  expect(harness.persistence.values.get("p1")?.resource?.label).toBe("My workspace");

  harness.browser.pop(ticketEntry);
  expect(harness.registry.store.getState().location?.resource?.id).toBe("PS-326");
});
