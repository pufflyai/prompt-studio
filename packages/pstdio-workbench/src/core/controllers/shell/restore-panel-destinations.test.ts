import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

test("repair keeps both previews and its pinned resource through a second reload", async () => {
  const saved = new Map();
  const create = (restrict = false) => {
    const w = harness(saved, restrict ? ["secondary"] : undefined);
    w.modePlacements.registerPlacement({
      id: "other",
      ref: { kind: "placement", extensionId: "test", id: "other" },
      modeId: "edit",
      region: "secondary",
      item: {
        kind: "binding",
        binding: {
          view: { kind: "view", id: "editor" },
          kinds: [{ kind: "resource-kind", id: "file" }],
          cardinality: "many",
        },
      },
    });
    return w;
  };
  const first = create();
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("draft"), open: "preview" });
  await first.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: "test", id: "other" },
    resource: resource("existing"),
    open: "preview",
  });
  const restored = create(true);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(
    restored.layout
      .listPanelInstances("secondary")
      .map((p) => p.resource?.id)
      .sort(),
  ).toEqual(["draft", "existing"]);
  await restored.navigation.openTarget(navigate("beta"));
  expect(restored.layout.listPanelInstances("secondary").find((p) => p.resource?.id === "draft")?.tabRetention).toBe(
    "persistent",
  );
  const again = create(true);
  await again.navigation.openTarget(navigate("alpha"));
  expect(again.layout.listPanelInstances("secondary").find((p) => p.resource?.id === "draft")?.tabRetention).toBe(
    "persistent",
  );
});

test("repair of a moved page resource preserves its pin across page visits and reload", async () => {
  const saved = new Map();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget(openFile("draft"));
  first.movePanel(first.layout.getActivePanel("main")!.instanceId, "secondary");
  const restored = harness(saved);
  restored.modes.getMode("edit")!.panels = ["main", "side"];
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.listPanelInstances("main").find((p) => p.resource?.id === "draft")?.tabRetention).toBe(
    "persistent",
  );
  await restored.navigation.openTarget(navigate("beta"));
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.listPanelInstances("main").filter((p) => p.resource?.id === "draft")).toHaveLength(1);
});

test("a repaired preview keeps its retention in its owner through subsequent reconciliation", async () => {
  const saved = new Map();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("draft"), open: "preview" });
  const restored = harness(saved, ["secondary"]);
  await restored.navigation.openTarget(navigate("alpha"));
  const draft = restored.layout.getActivePanel("secondary")!;
  expect(draft.tabRetention).toBe("persistent");
  await restored.navigation.openTarget(navigate("beta"));
  expect(
    restored.layout.listPanelInstances("secondary").find((p) => p.instanceId === draft.instanceId)?.tabRetention,
  ).toBe("persistent");
  await restored.navigation.openTarget({ kind: "panel", panel, resource: resource("next"), open: "preview" });
  expect(restored.layout.listPanelInstances("secondary").map((p) => p.resource?.id)).toContain("draft");
});

test("a mode removing a moved destination repairs unconstrained tabs instead of losing them", async () => {
  const saved = new Map();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("draft"), open: "pin" });
  first.movePanel(first.layout.getActivePanel("side")!.instanceId, "secondary");
  const restored = harness(saved);
  restored.modes.getMode("edit")!.panels = ["main", "side"];
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.listPanelInstances().filter((p) => p.resource?.id === "draft")).toHaveLength(1);
  expect(restored.layout.listPanelInstances("secondary")).toEqual([]);
});

test("restoration repairs a saved destination against the mode declaration without duplicating the tab", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("draft"), open: "pin" });
  const tab = w.layout.getActivePanel("side")!;
  const stale = w.layout.getLayout();
  const restored = harness(saved, ["secondary"]);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.listPanelInstances("secondary").map((p) => p.resource?.id)).toEqual(["draft"]);
  expect(restored.layout.listPanelInstances("side")).toEqual([]);
  restored.layout.restoreLayout(stale);
  expect(restored.layout.getActivePanel("secondary")?.instanceId).toBe(tab.instanceId);
  restored.resetPanelLayout();
  expect(restored.layout.listPanelInstances("secondary")).toHaveLength(1);
});

test("legacy allowed regions constrain restoration and reset through the same destination policy", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.layout.registerPanel({ id: "legacy", title: "Legacy", region: "side", rendererId: "editor" });
  const tab = w.layout.openPanel("legacy", { resource: resource("draft"), strategy: { kind: "persistent" } });
  w.modes.getMode("edit")!.listAddablePanels = () => [
    { panelId: "legacy", region: "secondary", allowedRegions: ["secondary"] },
  ];
  w.layout.restoreLayout(w.layout.getLayout());
  expect(w.layout.getActivePanel("secondary")?.instanceId).toBe(tab.instanceId);
  expect(w.getPanelDestinations(tab.instanceId)).toEqual(["secondary"]);
  w.resetPanelLayout();
  expect(w.layout.listPanelInstances("secondary").filter((p) => p.instanceId === tab.instanceId)).toHaveLength(1);
});
