import { describe, expect, test } from "bun:test";
import { createWorkbenchPanelsController } from "../../controllers/panels/panels-controller";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createLayoutModel, type LayoutModel } from "../layout/layout-model";
import { createWorkbenchModeRegistry, type WorkbenchModeActivationContext } from "./mode-registry";

const createContext = (layout: LayoutModel) =>
  ({
    context: createContextKeyService(),
    layout,
    panels: createWorkbenchPanelsController(),
  }) as unknown as WorkbenchModeActivationContext;

describe("mode Location restoration", () => {
  test("keeps an active Sub Panel subordinate to the existing mode Location", () => {
    const layout = createLayoutModel();
    layout.registerLocation({
      id: "tickets",
      title: "Tickets",
      region: "main",
      rendererId: "tickets",
    });
    layout.registerSubPanel({
      id: "preview",
      title: "Preview",
      region: "main",
      rendererId: "preview",
    });
    layout.openPanel("tickets", {
      resource: { kind: "tickets", uri: "pstdio://tickets" },
      strategy: { kind: "persistent" },
    });
    layout.openPanel("preview", {
      resource: { kind: "preview", uri: "pstdio://preview" },
      strategy: { kind: "persistent" },
    });
    expect(layout.getLayout().activeLocationWidgetId).toBe("tickets");
    expect(layout.getLayout().regions.main.widgets.map((placement) => placement.role)).toEqual([
      "location",
      "sub-panel",
    ]);
    const established: string[] = [];
    const registry = createWorkbenchModeRegistry({
      establishLocation: (instanceId) => established.push(instanceId),
      resolveContext: () => createContext(layout),
    });
    registry.registerMode({ id: "project", activate: () => undefined, seed: () => undefined });

    registry.setActiveMode("project");

    expect(established).toEqual(["tickets"]);
  });
});
