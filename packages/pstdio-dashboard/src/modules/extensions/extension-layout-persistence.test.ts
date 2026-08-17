import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { createLocalStorageLayoutPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { registerExtensionLayoutResetCommands } from "./extension-layout-persistence";

const extensionId = "pstdio.extension-lab";
const panelId = "extension-lab.overview";

const metadata = {
  extensions: [{ id: extensionId, name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [],
  diagnostics: [],
  menuContributions: [],
  modes: [],
  panels: [
    {
      id: panelId,
      extensionId,
      region: "main",
      closable: false,
      title: "Overview",
      renderer: { kind: "tree", id: panelId },
    },
  ],
  routes: [],
  settingsPanels: [],
} satisfies ResolvedWorkbenchExtensionMetadata;

const createStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const createLayout = () => {
  const layout = createWorkbenchCore().layout.getLayout();
  layout.regions.main.widgets = [
    { widgetId: panelId, contributionId: panelId, pinned: true },
    { widgetId: "dashboard.native", contributionId: "dashboard.native" },
  ];
  layout.regions.main.activeWidgetId = panelId;
  layout.activeWidgetId = panelId;
  return layout;
};

describe("extension layout persistence", () => {
  test("the local reset command updates active and stored project layouts only", async () => {
    const storage = createStorage();
    const layoutPersistence = createLocalStorageLayoutPersistence({
      debounceMs: 60_000,
      namespace: "dashboard-wb",
      storage,
    });
    const projectLayout = createLayout();
    const resourceLayout = createLayout();
    const otherProjectLayout = createLayout();
    layoutPersistence.setLayout(projectLayout, "project/project-1/mode/project/aggregate/empty");
    layoutPersistence.setLayout(resourceLayout, "project/project-1/mode/project/resource/resource://one");
    layoutPersistence.setLayout(otherProjectLayout, "project/project-2/mode/project/aggregate/empty");
    layoutPersistence.flush?.();

    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({
      id: panelId,
      title: "Overview",
      region: "main",
      rendererId: panelId,
      singleton: true,
      closable: false,
    });
    workbench.layout.registerPanel({
      id: "dashboard.native",
      title: "Native",
      region: "main",
      rendererId: "dashboard.native",
      singleton: true,
      closable: false,
    });
    workbench.layout.restoreLayout(projectLayout);
    const disposables = registerExtensionLayoutResetCommands({
      ctx: workbench,
      layoutPersistence,
      metadata,
      projectId: "project-1",
    });

    expect(workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath)).toContainEqual(
      expect.objectContaining({ commandId: `dashboard.extensions.resetLayout.${extensionId}` }),
    );

    await workbench.commands.executeCommand(`dashboard.extensions.resetLayout.${extensionId}`);

    expect(workbench.layout.getLayout().regions.main.widgets.map((placement) => placement.widgetId)).toEqual([
      "dashboard.native",
    ]);
    expect(
      layoutPersistence
        .getLayout("project/project-1/mode/project/aggregate/empty")
        ?.regions.main.widgets.map((placement) => placement.widgetId),
    ).toEqual(["dashboard.native"]);
    expect(
      layoutPersistence
        .getLayout("project/project-1/mode/project/resource/resource://one")
        ?.regions.main.widgets.map((placement) => placement.widgetId),
    ).toEqual(["dashboard.native"]);
    expect(
      layoutPersistence
        .getLayout("project/project-2/mode/project/aggregate/empty")
        ?.regions.main.widgets.map((placement) => placement.widgetId),
    ).toEqual([panelId, "dashboard.native"]);

    for (const disposable of disposables) disposable.dispose();
    layoutPersistence.dispose?.();
  });
});
