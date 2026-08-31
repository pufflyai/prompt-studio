import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { getWorkbenchPageRegistryInternals } from "../../core/registries/pages/page-registry-internals";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";
import {
  activate,
  extensionId,
  listPageId,
  metadata,
  modeId,
  pageId,
} from "./workbench-extension-mode-placements.test-support";

describe("extension mode placement registration", () => {
  test("composes mode and page placements in one region and keeps only the active owners", () => {
    const workbench = createWorkbenchCore();
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata,
      projectId: "project-1",
      workbench,
    });

    activate(workbench, pageId);
    expect(workbench.layout.getLayout().regions.side.widgets.map((widget) => widget.placementIdentity)).toEqual([
      {
        kind: "mode",
        modeId,
        placementId: `${extensionId}.placement.sessions`,
        instanceKey: "default",
      },
      { kind: "page", pageId, slotId: "emoji", instanceKey: "default" },
    ]);

    activate(workbench, listPageId);
    expect(workbench.layout.getLayout().regions.side.widgets.map((widget) => widget.placementIdentity)).toEqual([
      {
        kind: "mode",
        modeId,
        placementId: `${extensionId}.placement.sessions`,
        instanceKey: "default",
      },
    ]);
    expect(workbench.pages.store.getState().reconciliation.retain.map((item) => item.identity)).toContainEqual({
      kind: "mode",
      modeId,
      placementId: `${extensionId}.placement.sessions`,
      instanceKey: "default",
    });

    registration.dispose();
    expect(workbench.modePlacements.listPlacements()).toEqual([]);
  });

  test("opens one preview and retains pinned resources for an explicit mode panel target", () => {
    const workbench = createWorkbenchCore();
    registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata,
      projectId: "project-1",
      workbench,
    });
    activate(workbench, pageId);
    const pages = getWorkbenchPageRegistryInternals(workbench.pages);
    const panel = { extensionId, kind: "placement" as const, id: "inspector" };

    pages.openPanel({ kind: "panel", panel, resource: { type: "artifact", id: "A" } });
    pages.openPanel({ kind: "panel", panel, resource: { type: "artifact", id: "B" }, open: "pin" });
    pages.openPanel({ kind: "panel", panel, resource: { type: "artifact", id: "C" } });

    const inspectors = workbench.layout
      .getLayout()
      .regions.side.widgets.filter(
        (widget) =>
          widget.placementIdentity?.kind === "mode" && widget.placementIdentity.placementId.endsWith("inspector"),
      );
    expect(inspectors.map((widget) => [widget.resource?.id, widget.tabRetention])).toEqual([
      ["B", "persistent"],
      ["C", "preview"],
    ]);
    expect(workbench.pages.store.getState().location).toEqual({
      page: { extensionId, kind: "page", id: "ticket" },
    });
  });

  test("rejects an ambiguous resource placement before registering contributions", () => {
    const workbench = createWorkbenchCore();
    const ambiguous = {
      ...metadata,
      resourceViews: [
        ...metadata.resourceViews,
        {
          ...metadata.resourceViews[0],
          id: `${extensionId}.resource-view.second-inspector`,
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    expect(() =>
      registerWorkbenchExtensionContributions({
        executeCommand: () => undefined,
        metadata: ambiguous,
        projectId: "project-1",
        workbench,
      }),
    ).toThrow(`Mode placement "${extensionId}.placement.inspector" must resolve exactly one resource view; found 2`);
    expect(workbench.modePlacements.listPlacements()).toEqual([]);
  });

  test("registers mode placements after their data table backing views", () => {
    const workbench = createWorkbenchCore();
    const tableViewId = `${extensionId}.view.catalog`;
    const tablePlacementId = `${extensionId}.placement.catalog`;
    const withDataTable = {
      ...metadata,
      views: [
        ...metadata.views,
        {
          id: tableViewId,
          localId: "catalog",
          extensionId,
          title: "Catalog",
          body: { kind: "dataTable" as const, queryHandlerId: `${tableViewId}.query` },
        },
      ],
      placements: [
        ...metadata.placements,
        {
          id: tablePlacementId,
          localId: "catalog",
          extensionId,
          mode: { extensionId, kind: "mode" as const, id: "project" },
          item: { kind: "view" as const, view: { extensionId, kind: "view" as const, id: "catalog" } },
          region: "main" as const,
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata: withDataTable,
      projectId: "project-1",
      workbench,
    });

    expect(workbench.views.getView(tableViewId)?.panelId).toBe(tableViewId);
    expect(workbench.modePlacements.listPlacements(modeId).map((placement) => placement.id)).toContain(
      tablePlacementId,
    );
    registration.dispose();
  });
});
