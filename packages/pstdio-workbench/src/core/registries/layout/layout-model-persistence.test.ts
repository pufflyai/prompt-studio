import { describe, expect, test } from "bun:test";
import {
  createLayoutModel,
  type LayoutModel,
  type LayoutPersistenceAdapter,
  type WorkbenchLayout,
} from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

const terminalContribution = {
  id: "workbench.terminal",
  title: "Terminal",
  region: "secondary" as const,
  singleton: false,
  reuse: "none" as const,
};

const createPersistedLayout = () => {
  const savedLayouts: WorkbenchLayout[] = [];
  const persistence = {
    getLayout: () => savedLayouts.at(-1),
    setLayout: (layout: WorkbenchLayout) => savedLayouts.push(structuredClone(layout)),
  };
  return { savedLayouts, persistence };
};

const createTerminalLayout = (persistence: LayoutPersistenceAdapter) => {
  const layout = createLayoutModel({ persistence });
  registerTestWidget(layout, terminalContribution);
  return layout;
};

const widgetIds = (layout: LayoutModel) =>
  layout.getLayout().regions.secondary.widgets.map((placement) => placement.widgetId);

describe("createLayoutModel persisted widget ids", () => {
  test("persists reordered tabs alongside preview tabs", () => {
    const { persistence } = createPersistedLayout();
    const firstLayout = createTerminalLayout(persistence);
    const first = firstLayout.openWidget(terminalContribution.id);
    const second = firstLayout.openWidget(terminalContribution.id);
    const preview = firstLayout.openWidget(terminalContribution.id, {
      tabRetention: "preview",
      tabPosition: "start",
    });
    firstLayout.reorderWidget(second.widgetId, { beforeWidgetId: first.widgetId });

    const restoredLayout = createTerminalLayout(persistence);

    expect(widgetIds(restoredLayout)).toEqual([preview.widgetId, second.widgetId, first.widgetId]);
  });

  test("restores a preview tab as a preview", () => {
    const { persistence } = createPersistedLayout();
    const firstLayout = createTerminalLayout(persistence);
    const preview = firstLayout.openWidget(terminalContribution.id, { tabRetention: "preview" });

    const restoredLayout = createTerminalLayout(persistence);
    const restored = restoredLayout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.widgetId === preview.widgetId);

    expect(restored?.tabRetention).toBe("preview");
  });

  test("restores preview tabs after leaving and returning to a scope", () => {
    const savedLayouts = new Map<string, WorkbenchLayout>();
    const persistence = {
      getLayout: (scope?: string) => savedLayouts.get(scope ?? "global"),
      setLayout: (layout: WorkbenchLayout, scope?: string) =>
        void savedLayouts.set(scope ?? "global", structuredClone(layout)),
    };
    const layout = createTerminalLayout(persistence);
    layout.setPersistenceScope("project");
    const preview = layout.openWidget(terminalContribution.id, { tabRetention: "preview" });

    layout.setPersistenceScope("workspace");
    expect(widgetIds(layout)).toEqual([]);

    layout.setPersistenceScope("project");

    expect(widgetIds(layout)).toEqual([preview.widgetId]);
    expect(layout.getLayout().regions.secondary.widgets[0]?.tabRetention).toBe("preview");
  });

  test("allocates a unique id after restoring non-singleton placements", () => {
    const { persistence } = createPersistedLayout();
    const firstLayout = createTerminalLayout(persistence);
    firstLayout.openWidget(terminalContribution.id);
    firstLayout.openWidget(terminalContribution.id);

    const restoredLayout = createTerminalLayout(persistence);
    const thirdPlacement = restoredLayout.openWidget(terminalContribution.id);

    expect(widgetIds(restoredLayout)).toEqual(["workbench.terminal", "workbench.terminal:1", "workbench.terminal:2"]);
    expect(restoredLayout.getLayout().regions.secondary.activeWidgetId).toBe(thirdPlacement.widgetId);

    const restoredAgain = createTerminalLayout(persistence);
    const fourthPlacement = restoredAgain.openWidget(terminalContribution.id);

    expect(widgetIds(restoredAgain)).toEqual([
      "workbench.terminal",
      "workbench.terminal:1",
      "workbench.terminal:2",
      "workbench.terminal:3",
    ]);
    expect(restoredAgain.getLayout().regions.secondary.activeWidgetId).toBe(fourthPlacement.widgetId);
  });

  test("repairs duplicate ids from a persisted layout before opening another placement", () => {
    const { savedLayouts, persistence } = createPersistedLayout();
    const firstLayout = createTerminalLayout(persistence);
    firstLayout.openWidget(terminalContribution.id);
    firstLayout.openWidget(terminalContribution.id);

    const corrupted = structuredClone(savedLayouts.at(-1)!);
    const duplicatedPlacement = corrupted.regions.secondary.widgets[1]!;
    corrupted.regions.secondary.widgets.push({ ...duplicatedPlacement, title: "Terminal 3" });
    corrupted.regions.secondary.activeWidgetId = duplicatedPlacement.widgetId;
    corrupted.activeWidgetId = duplicatedPlacement.widgetId;
    savedLayouts.push(corrupted);

    const restoredLayout = createTerminalLayout(persistence);

    expect(widgetIds(restoredLayout)).toEqual(["workbench.terminal", "workbench.terminal:1", "workbench.terminal:2"]);
    expect(restoredLayout.getLayout().regions.secondary.activeWidgetId).toBe("workbench.terminal:2");

    const fourthPlacement = restoredLayout.openWidget(terminalContribution.id);
    expect(fourthPlacement.widgetId).toBe("workbench.terminal:3");
  });
});
