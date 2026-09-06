import { describe, expect, test } from "bun:test";
import { registerResourcePage } from "./controllers/page-runtime/page-runtime-test-support";
import { createWorkbench } from "./workbench-core";

const registerView = (
  workbench: ReturnType<typeof createWorkbench>,
  view: {
    id: string;
    title: string;
  },
) => workbench.views.registerView({ ...view, body: { kind: "react", render: () => null } });
describe("workbench core page-owned panel transitions", () => {
  test("reveals the Side Panel when a page-owned side slot opens", async () => {
    const workbench = createWorkbench({ initialSidePanelMode: "closed" });
    const page = { extensionId: "pstdio.test", kind: "page" as const, id: "lab" };
    const detailPanel = { kind: "page-slot" as const, page, id: "detail" };
    workbench.modes.registerMode({ id: "lab", activate: () => undefined });
    registerView(workbench, { id: "overview", title: "Overview" });
    registerView(workbench, { id: "detail", title: "Detail" });
    registerResourcePage(workbench, {
      id: "test.lab",
      ref: page,
      title: "Lab",
      path: "lab",
      modeId: "lab",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "overview",
        },
        cardinality: "one",
      },
      slots: [
        {
          id: "detail",
          region: "side",
          item: {
            kind: "binding",
            binding: {
              kinds: [
                {
                  kind: "resource-kind",
                  id: "artifact",
                },
              ],
              view: {
                kind: "view",
                id: "detail",
              },
              cardinality: "many",
            },
          },
        },
      ],
    });
    workbench.pageLocations.setProject("project-1");
    await workbench.navigation.openTarget({ kind: "page", page });
    await workbench.navigation.openTarget({
      kind: "panel",
      panel: detailPanel,
      resource: { type: "artifact", id: "artifact-1", label: "Artifact" },
      open: "preview",
    });
    expect(workbench.sidePanel.getMode()).toBe("attached");
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({
        contributionId: "workbench.page-placement.test.lab.detail",
        resource: expect.objectContaining({ id: "artifact-1" }),
      }),
    ]);
  });
  test("retains a mode panel opened by a primary-resource listener", async () => {
    const workbench = createWorkbench();
    const page = { extensionId: "pstdio.test", kind: "page" as const, id: "workspace" };
    const panel = { extensionId: "pstdio.test", kind: "placement" as const, id: "session" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registerView(workbench, { id: "workspace", title: "Workspace" });
    registerView(workbench, { id: "session", title: "Session" });
    registerResourcePage(workbench, {
      id: "test.workspace",
      ref: page,
      title: "Workspace",
      path: "workspace",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "workspace",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "workspace",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.modePlacements.registerPlacement({
      id: "test.session",
      ref: panel,
      modeId: "project",
      item: {
        kind: "binding",
        binding: {
          kinds: [
            {
              kind: "resource-kind",
              id: "session",
            },
          ],
          view: {
            kind: "view",
            id: "session",
          },
          cardinality: "many",
        },
      },
      region: "side",
    });
    workbench.pageLocations.setProject("project-1");
    workbench.onDidChangePrimaryResource(() => {
      void workbench.navigation.openTarget({
        kind: "panel",
        panel,
        resource: { type: "session", id: "session-1", label: "Session" },
        open: "preview",
      });
    });
    await workbench.navigation.openTarget({
      kind: "page",
      page,
      resource: { type: "workspace", id: "workspace-1", label: "Workspace" },
    });
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({
        contributionId: "workbench.mode-placement.test.session",
        resource: expect.objectContaining({ id: "session-1" }),
      }),
    ]);
    expect(workbench.pages.store.getState().placements.some((item) => item.identity.kind === "mode")).toBe(true);
  });
  test("rejects an unresolved mode placement before publishing it", () => {
    const workbench = createWorkbench();
    expect(() =>
      workbench.modePlacements.registerPlacement({
        id: "pstdio.placement.missing",
        ref: { extensionId: "pstdio", kind: "placement", id: "missing" },
        modeId: "project",
        item: {
          kind: "view",
          presence: "open",
          view: {
            kind: "view",
            id: "missing-view",
          },
        },
        region: "side",
      }),
    ).toThrow("Workbench mode placement view is not registered: missing-view");
    expect(workbench.modePlacements.listPlacements()).toEqual([]);
  });
});
