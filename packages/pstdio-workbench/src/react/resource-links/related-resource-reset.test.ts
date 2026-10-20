import { expect, test } from "bun:test";
import { createLocalStorageWorkbenchPersistence } from "../../storage/local-storage-persistence";
import { opening, ref, setup } from "./related-resource-openings.fixture";

test.each([
  "side",
  "secondary",
] as const)("page choice reset preserves live %s tabs and other pages' closures", async (region) => {
  const s = setup();
  s.setResolver(async (resource) => [opening(`${resource.id}-related`, region)]);
  const visit = async (id: string) => {
    const source = ref("document", id);
    s.workbench.pageLocations.navigate(s.target(source));
    await s.controller.open(source);
  };
  await visit("other");
  s.workbench.shell.setRegionOpen(region, false);
  await visit("source");
  const related = s.workbench.layout.getActivePanel(region)!;
  s.workbench.movePanel(related.instanceId, "main");
  s.workbench.shell.setRegionOpen(region, false);
  const before = s.workbench.layout.getLayout();
  await s.workbench.commands.executeCommand("workbench.resetPageChoices");
  expect(s.workbench.layout.getLayout()).toBe(before);
  await visit("other");
  expect(s.workbench.shell.getRegionState(region).open).toBe(false);
  await visit("source");
  expect(s.workbench.layout.listPanelInstances("main").find((p) => p.instanceId === related.instanceId)).toBeDefined();
  expect(s.workbench.layout.listPanelInstances(region).some((p) => p.resource?.id === "source-related")).toBe(false);
  s.workbench.movePanel(related.instanceId, region);
  s.workbench.closePlacement(related.placementIdentity!);
  s.workbench.resetPageChoices();
  await visit("other");
  await visit("source");
  expect(s.workbench.shell.getRegionState(region).open).toBe(true);
  expect(s.workbench.layout.listPanelInstances(region).filter((p) => p.resource?.id === "source-related")).toHaveLength(
    1,
  );
  s.controller.dispose();
});

test("panel reset does not save its visibility changes as page choices", async () => {
  const s = setup([opening("default")]);
  await s.controller.open(s.source);
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.resetPanelLayout();
  s.workbench.pageLocations.navigate(s.target(ref("document", "other")));
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});

test("page reset from a manual Bottom tab survives persistence-scope navigation", async () => {
  const s = setup([opening("default")], {
    resolvePagePersistenceScope: ({ projectId, modeId, resource, pageId }) => ({
      scope: `${projectId}/${modeId}/${resource?.id ?? pageId}`,
      carryRegions: ["side", "secondary"],
    }),
  });
  const leave = () =>
    s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  const reopen = async () => {
    s.workbench.pageLocations.navigate(s.target(s.source));
    await s.controller.open(s.source);
  };
  await s.controller.open(s.source);
  s.workbench.shell.setRegionOpen("side", false);
  leave();
  await reopen();
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.workbench.shell.setRegionOpen("side", true);
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.shellPlacements.registerPlacement({
    id: "manual",
    region: "secondary",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "session" }],
        cardinality: "many",
      },
    },
  });
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("session", "terminal"),
    open: "pin",
  });
  await s.workbench.commands.executeCommand("workbench.resetPageChoices");
  leave();
  await reopen();
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  expect(s.workbench.layout.getActivePanel("secondary")?.resource?.id).toBe("terminal");
  s.controller.dispose();
});

test("page reset clears manual choices made before a related lookup completes", async () => {
  const s = setup();
  const gate = Promise.withResolvers<ReturnType<typeof opening>[]>();
  s.setResolver(() => gate.promise);
  const pending = s.controller.open(s.source);
  s.workbench.shell.setRegionOpen("side", true);
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.resetPageChoices();
  gate.resolve([opening("default")]);
  await pending;
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.controller.dispose();
});

test("a deferred menu reset clears its initiating page after navigation", async () => {
  const s = setup([opening("default")]);
  const visit = async (id: string) => {
    const source = ref("document", id);
    s.workbench.pageLocations.navigate(s.target(source));
    await s.controller.open(source);
  };
  await visit("source");
  s.workbench.shell.setRegionOpen("side", false);
  const target = { projectId: "project", pageId: "documents", resource: s.source };
  await visit("other");
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.resetPageChoices(target);
  await visit("source");
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  await visit("other");
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});

test("page reset survives reload while other pages' closures and unrelated preferences remain", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const create = () =>
    setup([opening("default")], createLocalStorageWorkbenchPersistence({ namespace: "reset", storage }));
  const first = create();
  await first.controller.open(first.source);
  first.workbench.shell.setRegionOpen("side", false);
  const other = ref("document", "other");
  first.workbench.pageLocations.navigate(first.target(other));
  await first.controller.open(other);
  first.workbench.shell.setRegionOpen("side", false);
  first.workbench.pageLocations.navigate(first.target(first.source));
  await first.controller.open(first.source);
  first.workbench.resetPageChoices();
  first.workbench.preferences.setOwnedValue("editor", "draft", "Keep this", { scope: "user", scopeId: "source" });
  first.controller.dispose();
  const second = create();
  await second.controller.open(second.source);
  expect(second.workbench.shell.getRegionState("side").open).toBe(true);
  second.workbench.pageLocations.navigate(second.target(other));
  await second.controller.open(other);
  expect(second.workbench.shell.getRegionState("side").open).toBe(false);
  expect(second.workbench.preferences.getOwnedValue("editor", "draft", { scope: "user", scopeId: "source" })).toBe(
    "Keep this",
  );
  second.controller.dispose();
});
