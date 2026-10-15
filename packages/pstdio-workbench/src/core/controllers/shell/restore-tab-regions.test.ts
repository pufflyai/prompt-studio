import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

for (const destination of ["secondary", "main"] as const) {
  test(`restore repairs a moved tab into ${destination} with matching ownership across navigation and reload`, async () => {
    const saved = new Map<string | undefined, WorkbenchLayout>();
    const first = harness(saved);
    await first.navigation.openTarget(navigate("alpha"));
    await first.navigation.openTarget(openFile("readme"));
    const tab = first.layout.getLayout().regions.main.widgets[0]!;
    first.movePanel(tab.widgetId, "side");
    const moved = first.layout.getLayout().regions.side.widgets[0]!;
    await first.dispose();
    const settings = {
      regionSettings: {
        side: { acceptsTabs: false },
        secondary: { acceptsTabs: destination === "secondary" },
      },
    };
    const restored = harness(saved, settings);
    try {
      await restored.navigation.openTarget(navigate("alpha"));
      expect(restored.getPanelDestinations(tab.widgetId)).not.toContain("side");
      expect(restored.layout.getLayout().regions.side.widgets.map((item) => item.widgetId)).not.toContain(tab.widgetId);
      expect(restored.layout.getLayout().regions[destination].widgets).toContainEqual(
        expect.objectContaining({
          widgetId: tab.widgetId,
          resource: tab.resource,
          placementIdentity:
            destination === "secondary"
              ? moved.placementIdentity
              : expect.objectContaining({ kind: "page", pageId: "workspace" }),
        }),
      );
      await restored.navigation.openTarget(navigate("beta"));
      expect(restored.layout.getLayout().regions.main.widgets.map((item) => item.widgetId)).not.toContain(tab.widgetId);
      if (destination === "secondary")
        expect(restored.layout.getLayout().regions.secondary.widgets).toContainEqual(
          expect.objectContaining({
            widgetId: tab.widgetId,
            resource: tab.resource,
            placementIdentity: moved.placementIdentity,
          }),
        );
      await restored.navigation.openTarget(navigate("alpha"));
      expect(restored.layout.getLayout().regions[destination].widgets).toContainEqual(
        expect.objectContaining({ widgetId: tab.widgetId, resource: tab.resource }),
      );
    } finally {
      await restored.dispose();
    }
    const reloaded = harness(saved, settings);
    try {
      await reloaded.navigation.openTarget(navigate("beta"));
      expect(reloaded.layout.getLayout().regions.main.widgets.map((item) => item.widgetId)).not.toContain(tab.widgetId);
      if (destination === "secondary")
        expect(reloaded.layout.getLayout().regions.secondary.widgets).toContainEqual(
          expect.objectContaining({
            widgetId: tab.widgetId,
            resource: tab.resource,
            placementIdentity: moved.placementIdentity,
          }),
        );
      await reloaded.navigation.openTarget(navigate("alpha"));
      expect(reloaded.layout.getLayout().regions[destination].widgets).toContainEqual(
        expect.objectContaining({ widgetId: tab.widgetId, resource: tab.resource }),
      );
    } finally {
      await reloaded.dispose();
    }
  });
}

test("restore moves a tab out of a fixed-hidden destination", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget(openFile("readme"));
  const tab = first.layout.getLayout().regions.main.widgets[0]!;
  first.movePanel(tab.widgetId, "side");
  await first.dispose();
  const restored = harness(saved, {
    defaultPanelOpenByRegionId: { side: false },
    regionSettings: { side: { canOpen: false, canClose: false } },
  });
  try {
    await restored.navigation.openTarget(navigate("alpha"));
    expect(restored.shell.getPanelPolicy("side")).toMatchObject({ open: false, canOpen: false });
    expect(restored.getPanelDestinations(tab.widgetId)).not.toContain("side");
    expect(restored.layout.getLayout().regions.side.widgets.map((item) => item.widgetId)).not.toContain(tab.widgetId);
    expect(restored.layout.getLayout().regions.secondary.widgets).toContainEqual(
      expect.objectContaining({ widgetId: tab.widgetId, resource: tab.resource }),
    );
  } finally {
    await restored.dispose();
  }
});

test("restore retains content authored in a panel that refuses additional tabs", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("session") });
  const tab = first.layout.getLayout().regions.side.widgets[0]!;
  await first.dispose();
  const restored = harness(saved, { regionSettings: { side: { acceptsTabs: false } } });
  try {
    await restored.navigation.openTarget(navigate("alpha"));
    expect(restored.layout.getLayout().regions.side.widgets).toContainEqual(
      expect.objectContaining({ widgetId: tab.widgetId, resource: tab.resource }),
    );
  } finally {
    await restored.dispose();
  }
});

test("restore retains authored content in its fixed-hidden panel", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("session") });
  const tab = first.layout.getLayout().regions.side.widgets[0]!;
  await first.dispose();
  const restored = harness(saved, {
    defaultPanelOpenByRegionId: { side: false },
    regionSettings: { side: { canOpen: false, canClose: false } },
  });
  try {
    await restored.navigation.openTarget(navigate("alpha"));
    expect(restored.shell.getPanelPolicy("side")).toMatchObject({ open: false, canOpen: false });
    expect(restored.layout.getLayout().regions.side.widgets).toContainEqual(
      expect.objectContaining({ widgetId: tab.widgetId, resource: tab.resource }),
    );
  } finally {
    await restored.dispose();
  }
});

test("restore retains a legacy panel's authored content when it refuses incoming tabs", async () => {
  const core = createWorkbench({ regionSettings: { secondary: { acceptsTabs: false } } });
  core.modes.registerMode({
    id: "legacy",
    panelHeaders: "legacy",
    panels: ["main", "secondary"],
    activate() {},
  });
  core.modes.setActiveMode("legacy");
  core.layout.registerPanel({
    id: "player",
    title: "Player",
    region: "secondary",
    rendererId: "player",
    singleton: true,
    closable: false,
  });
  try {
    core.layout.openWidget("player");
    core.layout.restoreLayout(core.layout.getLayout());
    expect(core.layout.getLayout().regions.secondary.widgets.map((tab) => tab.contributionId)).toEqual(["player"]);
  } finally {
    await core.dispose();
  }
});
