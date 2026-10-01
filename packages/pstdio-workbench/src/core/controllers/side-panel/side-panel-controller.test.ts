import { describe, expect, test } from "bun:test";
import type { LayoutPersistenceAdapter, WorkbenchLayout } from "../../registries/layout/layout-model";
import { createLayoutModel } from "../../registries/layout/layout-model";
import { createDisposable } from "../../shared/disposable";
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
