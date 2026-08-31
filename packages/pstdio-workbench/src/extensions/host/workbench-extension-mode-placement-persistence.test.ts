import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchPlacementState } from "../../core";
import { getWorkbenchPageRegistryInternals } from "../../core/registries/pages/page-registry-internals";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";
import { activate, extensionId, metadata, modeId, pageId } from "./workbench-extension-mode-placements.test-support";

describe("extension mode placement persistence", () => {
  test("restores pinned mode resources without restoring previews", () => {
    let saved: WorkbenchPlacementState | undefined;
    const persistence = {
      load: (projectId: string) => (projectId === "project-1" ? saved : undefined),
      save: (projectId: string, state: WorkbenchPlacementState) => {
        if (projectId === "project-1") saved = structuredClone(state);
      },
    };
    const setup = () => {
      const workbench = createWorkbenchCore({ placementStatePersistence: persistence });
      registerWorkbenchExtensionContributions({
        executeCommand: () => undefined,
        metadata,
        projectId: "project-1",
        workbench,
      });
      activate(workbench, pageId);
      return workbench;
    };

    const first = setup();
    const panel = { extensionId, kind: "placement" as const, id: "inspector" };
    const firstPages = getWorkbenchPageRegistryInternals(first.pages);
    firstPages.openPanel({
      kind: "panel",
      panel,
      resource: {
        type: "artifact",
        id: "pinned",
        projectId: "project-1",
        extensionId,
        label: "Pinned artifact",
        metadata: { source: "test" },
      },
      open: "pin",
    });
    firstPages.openPanel({
      kind: "panel",
      panel,
      resource: { type: "artifact", id: "preview" },
    });

    const restored = setup();
    const inspectors = restored.layout
      .getLayout()
      .regions.side.widgets.filter(
        (widget) =>
          widget.placementIdentity?.kind === "mode" && widget.placementIdentity.placementId.endsWith("inspector"),
      );

    expect(inspectors.map((widget) => [widget.resource, widget.tabRetention])).toEqual([
      [
        {
          kind: "artifact",
          uri: "pstdio://extension-resource/artifact/pinned",
          id: "pinned",
          projectId: "project-1",
          extensionId,
          label: "Pinned artifact",
          metadata: { source: "test" },
        },
        "persistent",
      ],
    ]);
  });

  test("persists an exact mode close without closing a page sibling in the same region", () => {
    let saved: WorkbenchPlacementState | undefined;
    const persistence = {
      load: () => saved,
      save: (_projectId: string, state: WorkbenchPlacementState) => {
        saved = structuredClone(state);
      },
    };
    const setup = () => {
      const workbench = createWorkbenchCore({ placementStatePersistence: persistence });
      registerWorkbenchExtensionContributions({
        executeCommand: () => undefined,
        metadata,
        projectId: "project-1",
        workbench,
      });
      activate(workbench, pageId);
      return workbench;
    };
    const modeIdentity = {
      kind: "mode" as const,
      modeId,
      placementId: `${extensionId}.placement.sessions`,
      instanceKey: "default",
    };

    const first = setup();
    getWorkbenchPageRegistryInternals(first.pages).closePanel(modeIdentity);
    expect(first.layout.getLayout().regions.side.widgets.map((widget) => widget.placementIdentity)).toEqual([
      { kind: "page", pageId, slotId: "emoji", instanceKey: "default" },
    ]);

    const restored = setup();
    expect(restored.layout.getLayout().regions.side.widgets.map((widget) => widget.placementIdentity)).toEqual([
      { kind: "page", pageId, slotId: "emoji", instanceKey: "default" },
    ]);
  });

  test("restores a static mode placement opened against its declaration default", () => {
    let saved: WorkbenchPlacementState | undefined;
    const persistence = {
      load: () => saved,
      save: (_projectId: string, state: WorkbenchPlacementState) => {
        saved = structuredClone(state);
      },
    };
    const setup = () => {
      const workbench = createWorkbenchCore({ placementStatePersistence: persistence });
      registerWorkbenchExtensionContributions({
        executeCommand: () => undefined,
        metadata,
        projectId: "project-1",
        workbench,
      });
      workbench.modePlacements.registerPlacement({
        id: "pstdio.hidden.placement.tool",
        ref: { extensionId: "pstdio.hidden", kind: "placement", id: "tool" },
        modeId,
        item: { kind: "view", viewId: `${extensionId}.view.sessions` },
        region: "side",
        defaultOpen: false,
      });
      activate(workbench, pageId);
      return workbench;
    };

    const first = setup();
    getWorkbenchPageRegistryInternals(first.pages).openPanel({
      kind: "panel",
      panel: { extensionId: "pstdio.hidden", kind: "placement", id: "tool" },
    });

    const restored = setup();
    expect(restored.layout.getLayout().regions.side.widgets.map((widget) => widget.placementIdentity)).toContainEqual({
      kind: "mode",
      modeId,
      placementId: "pstdio.hidden.placement.tool",
      instanceKey: "default",
    });
  });

  test("keeps a closed mode placement closed when placement declarations refresh", () => {
    const workbench = createWorkbenchCore();
    registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata,
      projectId: "project-1",
      workbench,
    });
    activate(workbench, pageId);
    const pages = getWorkbenchPageRegistryInternals(workbench.pages);
    pages.closePanel({
      kind: "mode",
      modeId,
      placementId: `${extensionId}.placement.sessions`,
      instanceKey: "default",
    });

    workbench.modePlacements.registerPlacement({
      id: "pstdio.refresh.placement.extra",
      ref: { extensionId: "pstdio.refresh", kind: "placement", id: "extra" },
      modeId,
      item: { kind: "view", viewId: `${extensionId}.view.sessions` },
      region: "side",
    });

    expect(workbench.layout.getLayout().regions.side.widgets.map((widget) => widget.placementIdentity)).toEqual([
      {
        kind: "mode",
        modeId,
        placementId: "pstdio.refresh.placement.extra",
        instanceKey: "default",
      },
      { kind: "page", pageId, slotId: "emoji", instanceKey: "default" },
    ]);
  });
});

describe("extension mode placement declaration reload", () => {
  test("keeps closed and pinned state while mode placements unregister and register again", () => {
    const workbench = createWorkbenchCore();
    registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata,
      projectId: "project-1",
      workbench,
    });
    activate(workbench, pageId);
    const pages = getWorkbenchPageRegistryInternals(workbench.pages);
    const staticPlacement = {
      id: "pstdio.reload.placement.tool",
      ref: { extensionId: "pstdio.reload", kind: "placement" as const, id: "tool" },
      modeId,
      item: { kind: "view" as const, viewId: `${extensionId}.view.sessions` },
      region: "side" as const,
    };
    const resourcePlacement = {
      id: "pstdio.reload.placement.inspector",
      ref: { extensionId: "pstdio.reload", kind: "placement" as const, id: "inspector" },
      modeId,
      item: {
        kind: "resource" as const,
        viewId: `${extensionId}.view.inspector`,
        resourceKind: "artifact",
        cardinality: "many" as const,
      },
      region: "side" as const,
    };
    const staticRegistration = workbench.modePlacements.registerPlacement(staticPlacement);
    const resourceRegistration = workbench.modePlacements.registerPlacement(resourcePlacement);
    pages.closePanel({
      kind: "mode",
      modeId,
      placementId: staticPlacement.id,
      instanceKey: "default",
    });
    pages.openPanel({
      kind: "panel",
      panel: resourcePlacement.ref,
      resource: { type: "artifact", id: "pinned" },
      open: "pin",
    });

    resourceRegistration.dispose();
    staticRegistration.dispose();
    workbench.modePlacements.registerPlacement(staticPlacement);
    workbench.modePlacements.registerPlacement(resourcePlacement);

    const reloaded = workbench.layout.getLayout().regions.side.widgets.filter((widget) => {
      const identity = widget.placementIdentity;
      return identity?.kind === "mode" && identity.placementId.startsWith("pstdio.reload.");
    });
    expect(
      reloaded.map((widget) => [
        widget.placementIdentity?.kind === "mode" ? widget.placementIdentity.placementId : undefined,
        widget.resource?.id,
      ]),
    ).toEqual([[resourcePlacement.id, "pinned"]]);
  });
});

describe("extension mode placement project isolation", () => {
  test("does not restore placement state from another project", () => {
    const states = new Map<string, WorkbenchPlacementState>();
    const persistence = {
      load: (projectId: string) => states.get(projectId),
      save: (projectId: string, state: WorkbenchPlacementState) => {
        states.set(projectId, structuredClone(state));
      },
    };
    const create = () => {
      const workbench = createWorkbenchCore({ placementStatePersistence: persistence });
      registerWorkbenchExtensionContributions({
        executeCommand: () => undefined,
        metadata,
        projectId: "project-1",
        workbench,
      });
      return workbench;
    };

    const projectOne = create();
    activate(projectOne, pageId, "project-1");
    const pages = getWorkbenchPageRegistryInternals(projectOne.pages);
    pages.openPanel({
      kind: "panel",
      panel: { extensionId, kind: "placement", id: "inspector" },
      resource: { type: "artifact", id: "project-one" },
      open: "pin",
    });
    pages.closePanel({
      kind: "mode",
      modeId,
      placementId: `${extensionId}.placement.sessions`,
      instanceKey: "default",
    });

    activate(projectOne, pageId, "project-2");
    const modeWidgets = projectOne.layout
      .getLayout()
      .regions.side.widgets.filter((widget) => widget.placementIdentity?.kind === "mode");
    expect(modeWidgets.map((widget) => [widget.placementIdentity?.instanceKey, widget.resource?.id])).toEqual([
      ["default", undefined],
    ]);
  });
});
