import { describe, expect, test } from "bun:test";
import type { LayoutPersistenceAdapter, WorkbenchLayout } from "../../registries/layout/layout-model";
import { createLayoutModel } from "../../registries/layout/layout-model";
import { createDisposable } from "../../shared/disposable";
import { createWorkbench } from "../../workbench-core";
import { createWorkbenchSidePanelController } from "./side-panel-controller";

const createMemoryLayoutPersistence = (): LayoutPersistenceAdapter => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  return {
    getLayout: (scope) => layouts.get(scope),
    setLayout: (layout, scope) => void layouts.set(scope, layout),
  };
};

const createFloatingPolicy = () => {
  let floatingPanels: "visible" | "hidden" = "visible";
  const listeners = new Set<() => void>();
  return {
    getFloatingPanels: () => floatingPanels,
    onDidChangePolicy: (listener: () => void) => {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
    set(value: "visible" | "hidden") {
      floatingPanels = value;
      for (const listener of listeners) listener();
    },
  };
};

describe("createWorkbenchSidePanelController", () => {
  test("legacy hidden floating panels keep the requested floating default with attached presentation", async () => {
    const core = createWorkbench({ initialSidePanelMode: "closed" });
    let created = 0;
    core.commands.registerCommand(
      { id: "legacy-default", label: "Default" },
      {
        execute: () => {
          created++;
        },
      },
    );
    core.modes.registerMode({
      id: "legacy",
      floatingPanels: "hidden",
      floating: { defaultTab: { kind: "command", commandId: "legacy-default" } },
      activate() {},
    });
    core.modes.setActiveMode("legacy");
    await core.sidePanel.setMode("floating");
    expect(core.sidePanel.getMode()).toBe("attached");
    expect(created).toBe(1);
    await core.dispose();
  });
  test("presentation commands reject invalid and forbidden requests before mutation", async () => {
    const core = createWorkbench({ regionSettings: { side: { floatable: false } } });
    const before = core.layout.getLayout();
    for (const presentation of ["floating", "overlay"]) {
      await expect(core.commands.executeCommand("workbench.openSidePanel", { presentation })).rejects.toThrow();
      expect(core.layout.getLayout()).toBe(before);
    }
    await expect(
      core.commands.executeCommand("workbench.openSecondaryPanel", { presentation: "attached" }),
    ).rejects.toThrow("Only Side");
    expect(core.layout.getLayout()).toBe(before);
    await core.dispose();
  });
  test("explicit attached and floating opens share tabs and run the host default once", async () => {
    const core = createWorkbench({
      initialSidePanelMode: "closed",
      floating: { defaultTab: { kind: "command", commandId: "new-session" } },
    });
    let created = 0;
    core.layout.registerWidget({ id: "session", region: "side", title: "Session", rendererId: "session" });
    core.commands.registerCommand(
      { id: "new-session", label: "New session" },
      {
        execute() {
          created++;
          core.layout.openWidget("session");
        },
      },
    );
    await core.commands.executeCommand("workbench.openSidePanel", { presentation: "floating" });
    expect(core.sidePanel.getMode()).toBe("floating");
    expect(created).toBe(1);
    const tabs = core.layout.getLayout().regions.side.widgets;
    await core.commands.executeCommand("workbench.toggleSidePanel", { presentation: "attached" });
    expect(core.sidePanel.getMode()).toBe("attached");
    expect(core.layout.getLayout().regions.side.widgets).toEqual(tabs);
    await core.commands.executeCommand("workbench.toggleSidePanel", { presentation: "attached" });
    expect(core.sidePanel.getMode()).toBe("closed");
    await core.commands.executeCommand("workbench.openSidePanel", { presentation: "floating" });
    expect(created).toBe(1);
    await core.dispose();
  });
  test("starts floating by default and attached when floating is disabled", () => {
    expect(createWorkbenchSidePanelController({ layout: createLayoutModel() }).getMode()).toBe("floating");

    const controller = createWorkbenchSidePanelController({
      layout: createLayoutModel(),
      getFloatingPanels: () => "hidden",
    });
    expect(controller.canFloat()).toBe(false);
    expect(controller.getMode()).toBe("attached");
  });

  test("reads closed from a hidden side region and opens with the initial presentation", () => {
    const layout = createLayoutModel({ defaultRegionVisibility: { side: false } });
    const controller = createWorkbenchSidePanelController({ layout, initialMode: "attached" });

    expect(controller.getMode()).toBe("closed");
    layout.setRegionVisible("side", true);
    expect(controller.getMode()).toBe("attached");
  });

  test("shows a floating choice attached while floating is disabled and keeps the choice", () => {
    const policy = createFloatingPolicy();
    const controller = createWorkbenchSidePanelController({ layout: createLayoutModel(), ...policy });
    const events: string[] = [];
    controller.onDidChange((mode) => events.push(mode));

    policy.set("hidden");
    expect(controller.getMode()).toBe("attached");
    policy.set("visible");
    expect(controller.getMode()).toBe("floating");
    expect(events).toEqual(["attached", "floating"]);
  });

  test("saves a floating request as attached while floating is disabled", () => {
    const policy = createFloatingPolicy();
    const controller = createWorkbenchSidePanelController({ layout: createLayoutModel(), ...policy });
    policy.set("hidden");

    controller.setMode("closed");
    controller.setMode("floating");
    policy.set("visible");

    expect(controller.getMode()).toBe("attached");
  });

  test("notifies once per real transition until disposed", () => {
    const controller = createWorkbenchSidePanelController({ layout: createLayoutModel() });
    const events: string[] = [];
    const disposable = controller.onDidChange((mode) => events.push(mode));

    controller.setMode("floating");
    controller.setMode("attached");
    controller.setMode("attached");
    controller.setMode("closed");
    disposable.dispose();
    controller.setMode("floating");

    expect(events).toEqual(["attached", "closed"]);
  });

  test("follows the layout persistence scope", () => {
    const persistence = createMemoryLayoutPersistence();
    const layout = createLayoutModel({ defaultRegionVisibility: { side: false }, persistence });
    const controller = createWorkbenchSidePanelController({ layout });

    layout.setPersistenceScope("project/one");
    controller.setMode("attached");
    layout.setPersistenceScope("project/two");
    expect(controller.getMode()).toBe("closed");
    controller.setMode("floating");
    layout.setPersistenceScope("project/one");
    expect(controller.getMode()).toBe("attached");

    const restoredLayout = createLayoutModel({ defaultRegionVisibility: { side: false }, persistence });
    const restored = createWorkbenchSidePanelController({ layout: restoredLayout });
    restoredLayout.setPersistenceScope("project/two");
    expect(restored.getMode()).toBe("floating");
  });
});
