import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

test("the extension host carries view policies into declared placements", () => {
  const core = createWorkbench();
  const extensionId = "example";
  const viewId = "example.view.editor";
  core.registerModule({
    id: "view-policy",
    activate: (ctx) =>
      registerWorkbenchExtensionContributions({
        workbench: ctx,
        projectId: "project",
        executeCommand: () => [],
        metadata: {
          extensions: [{ id: extensionId, name: "example", displayName: "Example", sourcePath: "/example" }],
          commands: [],
          menuContributions: [],
          commandPaletteContributions: [],
          pages: [
            {
              id: "example.page.tools",
              localId: "tools",
              extensionId,
              title: "Tools",
              path: "tools",
              mode: { kind: "mode", extensionId, id: "tools" },
              main: { kind: "view", view: { kind: "view", extensionId, id: "editor" }, cardinality: "one" },
              slots: [],
            },
          ],
          modes: [
            { id: "example.mode.tools", localId: "tools", extensionId, label: "Tools", regions: ["main", "side"] },
          ],
          placements: [
            {
              id: "example.placement.editor",
              localId: "editor",
              extensionId,
              mode: { kind: "mode", extensionId, id: "tools" },
              region: "side",
              item: { kind: "view", view: { kind: "view", extensionId, id: "editor" }, presence: "open" },
            },
          ],
          views: [
            {
              id: viewId,
              localId: "editor",
              extensionId,
              title: "Editor",
              background: "keep-mounted",
              reveal: "explicit",
              defaultPanel: "side",
              body: { kind: "tree", bodyHandlerId: "body" },
            },
          ],
          viewMenus: [],
          navigationItems: [],
          navigationTrees: [],
          resourceKinds: [],
          resourceHierarchyProviders: [],
          settingsPanels: [],
          statusBarItems: [],
          statuses: [],
          diagnostics: [],
        },
      }),
  });
  core.pageLocations.switchProject("project");
  core.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId, id: "tools" } });
  expect(core.views.getView(viewId)).toMatchObject({
    background: "keep-mounted",
    reveal: "explicit",
    defaultPanel: "side",
  });
  expect(core.layout.getLayout().regions.side.widgets[0]).toMatchObject({
    mountStrategy: "keep-mounted",
    hiddenByDefault: true,
  });
});
