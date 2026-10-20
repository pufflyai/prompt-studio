import { expect, test } from "bun:test";
import type { RelatedResourceOpenings } from "@pstdio/sdk/extensions";
import type { PreferenceValue } from "../../core";
import { opening, ref, setup } from "./related-resource-openings.fixture";

test("a synchronous preference save failure does not prevent deleting a related target", async () => {
  const values = new Map<string, PreferenceValue>();
  let fail = false;
  const s = setup([opening("default")], {
    preferencePersistence: {
      getValue: (name, scope) => values.get(JSON.stringify([name, scope])),
      setValue(name, value, scope) {
        if (fail) throw new Error("Storage is full");
        values.set(JSON.stringify([name, scope]), value);
      },
    },
  });
  await s.controller.open(s.source);
  const tab = s.workbench.layout.getActivePanel("side")!;
  s.workbench.shellPlacements.updatePlacement(tab.placementIdentity!, { resource: ref("document", "chosen") });
  fail = true;
  expect(() => s.workbench.resources.removed(ref("document", "chosen"))).not.toThrow();
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test("a resolved compound cannot reopen a deleted resource under another candidate identity", async () => {
  const s = setup([opening("candidate")]);
  const resolving = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  s.service.resolve = async (resources) => {
    resolving.resolve();
    await release.promise;
    return resources.map((resource) => ({
      resource,
      target: { kind: "compound" as const, targets: [s.target(resource), s.target(ref("document", "deleted"))] },
    }));
  };
  const pending = s.controller.open(s.source);
  await resolving.promise;
  s.workbench.resources.removed(ref("document", "deleted"));
  release.resolve();
  await pending;
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

for (const phase of ["declaration", "resolution"] as const) {
  test(`deleting a target during related ${phase} keeps it closed and opens valid targets`, async () => {
    const s = setup();
    const entries = [opening("deleted"), opening("kept", "secondary")];
    const declaration = Promise.withResolvers<RelatedResourceOpenings>();
    const resolution = Promise.withResolvers<void>();
    const resolving = Promise.withResolvers<void>();
    s.setResolver(() => (phase === "declaration" ? declaration.promise : Promise.resolve(entries)));
    s.service.resolve = async (resources) => {
      resolving.resolve();
      if (phase === "resolution") await resolution.promise;
      return resources.map((resource) => ({ resource, target: s.target(resource) }));
    };
    const pending = s.controller.open(s.source);
    if (phase === "resolution") await resolving.promise;
    s.workbench.resources.removed(ref("document", "deleted"));
    declaration.resolve(entries);
    resolution.resolve();
    await pending;
    expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
    expect(s.workbench.layout.getActivePanel("secondary")?.resource?.id).toBe("kept");
    expect(s.workbench.getPrimaryResource()?.id).toBe("source");
    s.controller.dispose();
  });
}

test("deleting a retained source cancels its related lookup without closing its editor", async () => {
  const s = setup();
  const declaration = Promise.withResolvers<RelatedResourceOpenings>();
  s.setResolver(() => declaration.promise);
  const identity = s.workbench.layout.getActivePanel("main")!.placementIdentity!;
  const retain = s.workbench.resources.onWillRemove(() => [identity]);
  const pending = s.controller.open(s.source);
  s.workbench.resources.removed(s.source);
  declaration.resolve([opening("stale")]);
  await pending;
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  expect(s.workbench.layout.getActivePanel("main")?.placementIdentity).toEqual(identity);
  retain.dispose();
  s.controller.dispose();
});

test("removing the routed source while its owner loads keeps the parent route", async () => {
  const s = setup();
  const declaration = Promise.withResolvers<RelatedResourceOpenings>();
  s.setResolver(() => declaration.promise);
  const pending = s.controller.open(s.source);
  s.workbench.resources.removed(s.source);
  declaration.resolve([opening("stale")]);
  await pending;
  expect(s.workbench.pages.store.getState().activePageId).toBe("home");
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});

test.each([
  { extensionId: "another-owner" },
  { projectId: "another-project" },
  { type: "another-kind" },
])("an unrelated deletion does not suppress a related target: %j", async (identity) => {
  const s = setup();
  const declaration = Promise.withResolvers<RelatedResourceOpenings>();
  s.setResolver(() => declaration.promise);
  const pending = s.controller.open(s.source);
  s.workbench.resources.removed({ ...ref("document", "kept"), ...identity });
  declaration.resolve([opening("kept")]);
  await pending;
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("kept");
  s.controller.dispose();
});

test("deletion affects only pending results and does not block a later authoritative opening", async () => {
  const s = setup();
  const declaration = Promise.withResolvers<RelatedResourceOpenings>();
  s.setResolver(() => declaration.promise);
  const pending = s.controller.open(s.source);
  s.workbench.resources.removed(ref("document", "recreated"));
  declaration.resolve([opening("recreated")]);
  await pending;
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.setResolver(async () => [opening("recreated")]);
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("recreated");
  s.controller.dispose();
});

test("deleting a related target does not save its cleanup as a manual closure or resource choice", async () => {
  const s = setup([opening("deleted")]);
  await s.controller.open(s.source);
  s.workbench.resources.removed(ref("document", "deleted"));
  s.setResolver(async () => [opening("fresh")]);
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual(["fresh"]);
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.controller.dispose();
});

test("deleting a manually chosen target forgets its identity and preserves an explicit panel closure", async () => {
  const s = setup([opening("default")]);
  await s.controller.open(s.source);
  const tab = s.workbench.layout.getActivePanel("side")!;
  s.workbench.shellPlacements.updatePlacement(tab.placementIdentity!, { resource: ref("document", "chosen") });
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.resources.removed(ref("document", "chosen"));
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual(["default"]);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});

test.each([
  false,
  true,
])("a missing saved choice uses the current default after returning, closed=%s", async (closed) => {
  const s = setup([opening("default")]);
  await s.controller.open(s.source);
  const tab = s.workbench.layout.getActivePanel("side")!;
  s.workbench.shellPlacements.updatePlacement(tab.placementIdentity!, { resource: ref("document", "chosen") });
  if (closed) s.workbench.shell.setRegionOpen("side", false);
  s.workbench.pageLocations.navigate(s.target(ref("document", "other-source")));
  s.workbench.resources.removed(ref("document", "chosen"));
  s.service.resolve = async (resources) =>
    resources
      .filter((resource) => resource.id !== "chosen")
      .map((resource) => ({ resource, target: s.target(resource) }));
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual(["default"]);
  expect(s.workbench.shell.getRegionState("side").open).toBe(!closed);
  s.controller.dispose();
});
