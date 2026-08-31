import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { getWorkbenchPageRegistryInternals } from "../../core/registries/pages/page-registry-internals";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const extensionId = "pstdio.hostile";
const modeId = `${extensionId}.mode.project`;
const pageId = `${extensionId}.page.ticket`;
const listPageId = `${extensionId}.page.tickets`;

const webview = (path: string) => ({
  entry: { kind: "package-asset" as const, path, baseUrl: "file:///extensions/hostile/" },
  runtimeUrl: "/runtime.html",
  moduleUrl: `/${path}.js`,
});

const metadata = {
  ...emptyWorkbenchExtensionMetadata,
  extensions: [{ id: extensionId, name: "hostile", displayName: "Hostile", sourcePath: "/extensions/hostile" }],
  modes: [{ id: modeId, localId: "project", extensionId, label: "Project", regions: ["main", "side"] }],
  pages: [
    {
      id: listPageId,
      localId: "tickets",
      extensionId,
      title: "Tickets",
      path: "tickets",
      mode: { extensionId, kind: "mode", id: "project" },
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          view: { extensionId, kind: "view", id: "tickets" },
        },
      ],
    },
    {
      id: pageId,
      localId: "ticket",
      extensionId,
      title: "Ticket",
      path: "ticket",
      mode: { extensionId, kind: "mode", id: "project" },
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          view: { extensionId, kind: "view", id: "ticket" },
        },
        {
          id: "emoji",
          role: "auxiliary",
          region: "side",
          view: { extensionId, kind: "view", id: "emoji" },
          defaultOpen: true,
          order: 10,
        },
      ],
    },
  ],
  views: [
    {
      id: `${extensionId}.view.tickets`,
      localId: "tickets",
      extensionId,
      title: "Tickets",
      body: { kind: "webview", webview: webview("tickets.tsx") },
    },
    {
      id: `${extensionId}.view.ticket`,
      localId: "ticket",
      extensionId,
      title: "Ticket",
      body: { kind: "webview", webview: webview("ticket.tsx") },
    },
    {
      id: `${extensionId}.view.sessions`,
      localId: "sessions",
      extensionId,
      title: "Sessions",
      body: { kind: "webview", webview: webview("sessions.tsx") },
    },
    {
      id: `${extensionId}.view.emoji`,
      localId: "emoji",
      extensionId,
      title: "Emoji",
      body: { kind: "webview", webview: webview("emoji.tsx") },
    },
    {
      id: `${extensionId}.view.inspector`,
      localId: "inspector",
      extensionId,
      title: "Inspector",
      body: { kind: "webview", webview: webview("inspector.tsx") },
    },
  ],
  placements: [
    {
      id: `${extensionId}.placement.sessions`,
      localId: "sessions",
      extensionId,
      mode: { extensionId, kind: "mode", id: "project" },
      item: { kind: "view", view: { extensionId, kind: "view", id: "sessions" } },
      region: "side",
      order: 0,
    },
    {
      id: `${extensionId}.placement.inspector`,
      localId: "inspector",
      extensionId,
      mode: { extensionId, kind: "mode", id: "project" },
      item: {
        kind: "resource-slot",
        slot: { resourceKind: { extensionId, kind: "resource-kind", id: "artifact" }, id: "inspector" },
      },
      region: "side",
      order: 20,
    },
  ],
  resourceKinds: [
    {
      id: `${extensionId}.resource-kind.artifact`,
      localId: "artifact",
      extensionId,
      surface: "attached",
      label: "Artifact",
      slots: [{ id: "inspector", cardinality: "many", access: "owner" }],
    },
  ],
  resourceViews: [
    {
      id: `${extensionId}.resource-view.inspector`,
      extensionId,
      resourceKind: { extensionId, kind: "resource-kind", id: "artifact" },
      slot: { resourceKind: { extensionId, kind: "resource-kind", id: "artifact" }, id: "inspector" },
      view: { extensionId, kind: "view", id: "inspector" },
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const activate = (workbench: ReturnType<typeof createWorkbenchCore>, id: string) =>
  getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
    pageId: id,
    projectId: "project-1",
    location: {
      page: { extensionId, kind: "page", id: id === pageId ? "ticket" : "tickets" },
    },
    action: "testActivatePage",
  });

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
