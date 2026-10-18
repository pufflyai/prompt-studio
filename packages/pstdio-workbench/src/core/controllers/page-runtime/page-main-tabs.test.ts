import { expect, test } from "bun:test";
import { modePanelFixture } from "./mode-panel-state.fixture";

test.each([true, false])("a page's own pinned Main tabs stay on their resource, scoped=%s", (scoped) => {
  const s = modePanelFixture(undefined, scoped);
  s.navigate("document", "a");
  const a = s.w.layout.getActivePanel("main")!;
  s.w.pinPlacement(a.placementIdentity!);
  s.open("local", "main", "pin");
  s.navigate("document", "b");
  expect(s.ids("main")).toEqual(["b"]);
  s.w.pinPlacement(s.w.layout.getActivePanel("main")!.placementIdentity!);
  s.navigate("document", "a");
  expect(s.ids("main")).toEqual(["a", "local"]);
  expect(s.w.layout.listPanelInstances("main")[0]?.instanceId).toBe(a.instanceId);
  s.navigate("document", "b");
  expect(s.ids("main")).toEqual(["b"]);
});

test.each(["shell", "mode", "host"] as const)("a pinned %s tab moved into Main belongs to that page", (owner) => {
  const s = modePanelFixture();
  if (owner === "shell") s.open("local", "side", "pin");
  if (owner === "mode") {
    const panel = { kind: "placement" as const, extensionId: "test", id: "local" };
    s.w.modePlacements.registerPlacement({
      id: "local",
      ref: panel,
      modeId: "alpha",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "document" }],
          view: { kind: "view", id: "document" },
          cardinality: "many",
        },
      },
    });
    s.w.modePlacements.openPlacement({ panel, resource: { type: "document", id: "local" }, open: "pin" });
  }
  if (owner === "host") {
    s.w.layout.registerPanel({ id: "host", title: "Host", rendererId: "document", region: "side", reuse: "none" });
    s.w.layout.openPanel("host", { resource: { type: "document", id: "local" }, strategy: { kind: "persistent" } });
  }
  const local = s.w.layout.listPanelInstances("side")[0]!;
  s.w.movePanel(local.instanceId, "main");
  s.open("shared", "secondary", "pin");
  s.navigate("alpha-list");
  expect(s.ids("main")).not.toContain("local");
  expect(s.ids("side")).not.toContain("local");
  expect(s.ids("secondary")).toEqual(["shared"]);
  s.navigate("alpha");
  expect(s.w.layout.listPanelInstances("main").map((tab) => tab.instanceId)).toContain(local.instanceId);
  expect(s.ids("side")).not.toContain("local");
});

test.each([
  true,
  false,
])("Main tabs restore after navigation, mode switches and restart; custom scopes=%s", (scoped) => {
  const s = modePanelFixture(undefined, scoped);
  s.open("local", "side", "pin");
  const tab = s.w.layout.listPanelInstances("side")[0]!;
  s.w.movePanel(tab.instanceId, "main");
  s.navigate("alpha-list");
  expect(s.ids("main")).not.toContain("local");
  s.navigate("alpha");
  expect(s.ids("main")).toContain("local");
  s.navigate("bare");
  s.navigate("alpha");
  expect(s.ids("main")).toContain("local");
  const restored = modePanelFixture(s.saved, scoped);
  expect(restored.ids("main")).toContain("local");
  restored.navigate("alpha-list");
  expect(restored.ids("main")).not.toContain("local");
});

test("moving a Main tab back to Bottom makes it shared within the mode", () => {
  const s = modePanelFixture();
  s.open("local", "side", "pin");
  const tab = s.w.layout.listPanelInstances("side")[0]!;
  s.w.movePanel(tab.instanceId, "main");
  s.w.movePanel(tab.instanceId, "secondary");
  s.navigate("alpha-list");
  expect(s.ids("secondary")).toEqual(["local"]);
  s.navigate("alpha");
  expect(s.ids("secondary")).toEqual(["local"]);
  expect(s.ids("main")).not.toContain("local");
});

test("opening a page's saved Main resource in Side on another page keeps its current shared placement", () => {
  const s = modePanelFixture();
  s.open("local", "side", "pin");
  s.w.movePanel(s.w.layout.listPanelInstances("side")[0]!.instanceId, "main");
  s.navigate("alpha-list");
  s.open("local", "side", "pin");
  s.navigate("alpha");
  expect(s.ids("side")).toEqual(["local"]);
  expect(s.ids("main")).not.toContain("local");
});
