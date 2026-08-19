import { describe, expect, test } from "bun:test";
import { createWorkbenchPanelsController } from "../../controllers/panels/panels-controller";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createLayoutModel } from "../layout/layout-model";
import { createWorkbenchModeRegistry, type WorkbenchModeActivationContext } from "./mode-registry";

// Harvested from PS-259: reselecting the active mode must reconcile its layout
// without restarting the mode's active behavior.
describe("mode layout reconciliation", () => {
  test("reconciles an already-active mode without restarting its active behavior", () => {
    const layout = createLayoutModel();
    const context = {
      context: createContextKeyService(),
      layout,
      panels: createWorkbenchPanelsController(),
    } as unknown as WorkbenchModeActivationContext;
    const log: string[] = [];
    const registry = createWorkbenchModeRegistry({ resolveContext: () => context });

    registry.registerMode({
      id: "lab",
      activate: () => undefined,
      enter: () => {
        log.push("enter");
      },
      reconcile: () => {
        log.push("reconcile");
      },
    });

    registry.setActiveMode("lab");
    registry.setActiveMode("lab");

    expect(log).toEqual(["enter", "reconcile", "reconcile"]);
  });

  test("reconciles on persistence-scope changes without seeding an existing scope", () => {
    const snapshots = new Map<string | undefined, unknown>();
    const layout = createLayoutModel({
      persistence: {
        getLayout: (scope) => snapshots.get(scope) as ReturnType<typeof layout.getLayout> | undefined,
        setLayout: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
      },
    });
    const context = {
      context: createContextKeyService(),
      layout,
      panels: createWorkbenchPanelsController(),
    } as unknown as WorkbenchModeActivationContext;
    const log: string[] = [];
    const registry = createWorkbenchModeRegistry({ resolveContext: () => context });

    registry.registerMode({
      id: "lab",
      activate: () => undefined,
      seed: () => {
        log.push("seed");
      },
      reconcile: () => {
        log.push("reconcile");
      },
    });

    layout.setPersistenceScope("project/p1/mode/lab/resource/a");
    registry.setActiveMode("lab");
    layout.setPersistenceScope("project/p1/mode/lab/resource/b");
    // Returning to a scope that persisted a layout reconciles without reseeding.
    layout.setPersistenceScope("project/p1/mode/lab/resource/a");

    expect(log).toEqual(["seed", "reconcile", "seed", "reconcile", "reconcile"]);
  });
});
