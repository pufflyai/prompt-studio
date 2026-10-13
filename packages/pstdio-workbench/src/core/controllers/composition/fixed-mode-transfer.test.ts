import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, navigate } from "./placement-lifecycle-test-support";

const registerFixed = (workbench: ReturnType<typeof harness>, id = "tools", viewId = "editor") =>
  workbench.modePlacements.registerPlacement({
    id,
    ref: { kind: "placement", extensionId: "test", id },
    modeId: "edit",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: viewId }, presence: "fixed" },
  });

const create = (saved = new Map<string | undefined, WorkbenchLayout>()) => {
  const workbench = harness(saved);
  registerFixed(workbench);
  return workbench;
};

test("a new mode seeds its defaults alongside existing host panels", async () => {
  const workbench = harness();
  workbench.layout.registerPanel({ id: "host", title: "Host", region: "side", rendererId: "editor", closable: false });
  workbench.layout.openWidget("host", { role: "sub-panel" });
  registerFixed(workbench);
  await workbench.navigation.openTarget(navigate("alpha"));
  expect(workbench.layout.getLayout().regions.side.widgets.map((p) => p.contributionId)).toEqual(["host"]);
  expect(workbench.layout.getLayout().regions.secondary.widgets.map((p) => p.viewId)).toEqual(["editor"]);
  await workbench.dispose();
});

test("moving fixed mode tools into a page preserves the empty mode slot on other resources", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const workbench = create(saved);
  await workbench.navigation.openTarget(navigate("alpha"));
  const tools = workbench.layout.getLayout().regions.secondary.widgets[0]!;
  workbench.movePanel(tools.widgetId, "main");
  await workbench.navigation.openTarget(navigate("beta"));
  expect(workbench.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  await workbench.navigation.openTarget(navigate("alpha"));
  expect(workbench.layout.getLayout().regions.main.widgets.map((p) => p.widgetId)).toContain(tools.widgetId);
  expect(workbench.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  await workbench.dispose();
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  await restored.navigation.openTarget(navigate("beta"));
  expect(restored.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getLayout().regions.main.widgets.map((p) => p.widgetId)).toContain(tools.widgetId);
  await restored.dispose();
});

test("a new fixed mode declaration opens after its mode layout has been saved", async () => {
  const workbench = create();
  await workbench.navigation.openTarget(navigate("alpha"));
  registerFixed(workbench, "inspector", "empty");
  expect(workbench.layout.getLayout().regions.secondary.widgets.map((p) => p.viewId)).toContain("empty");
  await workbench.dispose();
});

test("explicitly opening a new mode tool updates saved membership without restoring moved tools", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const workbench = create(saved);
  await workbench.navigation.openTarget(navigate("alpha"));
  const tools = workbench.layout.getLayout().regions.secondary.widgets[0]!;
  workbench.movePanel(tools.widgetId, "main");
  await workbench.navigation.openTarget(navigate("beta"));
  await workbench.dispose();
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  registerFixed(restored, "inspector", "empty");
  await restored.navigation.openTarget(navigate("beta"));
  expect(restored.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  await restored.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: "test", id: "inspector" },
  });
  expect(restored.layout.getLayout().regions.secondary.widgets.map((p) => p.viewId)).toEqual(["empty"]);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getLayout().regions.main.widgets.map((p) => p.widgetId)).toContain(tools.widgetId);
  expect(restored.layout.getLayout().regions.secondary.widgets.map((p) => p.viewId)).toEqual(["empty"]);
  await restored.dispose();
});

test("returning transferred mode tools to Secondary persists their mode owner", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const workbench = create(saved);
  await workbench.navigation.openTarget(navigate("alpha"));
  const tools = workbench.layout.getLayout().regions.secondary.widgets[0]!;
  workbench.movePanel(tools.widgetId, "main");
  workbench.movePanel(tools.widgetId, "secondary");
  await workbench.navigation.openTarget(navigate("beta"));
  expect(workbench.layout.getLayout().regions.secondary.widgets.map((p) => p.widgetId)).toEqual([tools.widgetId]);
  await workbench.dispose();
  const restored = create(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getLayout().regions.secondary.widgets.map((p) => p.widgetId)).toEqual([tools.widgetId]);
  await restored.dispose();
});
