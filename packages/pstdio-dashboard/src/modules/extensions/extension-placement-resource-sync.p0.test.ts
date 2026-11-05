import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { extensionId, openNoteWorkbench, projectId, settle } from "./extension-resource-sync.fixture";

test("a closed viewer's pending refresh cannot overwrite the newer page resource", async () => {
  let finishPlacement: (resource: ResourceRef) => void = () => undefined;
  let requestedPlacement = false;
  const { workbench, open, dispose } = openNoteWorkbench((resource) => {
    if (resource.id !== "b") return resource;
    if (requestedPlacement) return { ...resource, label: "Current title", metadata: { writable: false } };
    requestedPlacement = true;
    return new Promise<ResourceRef>((resolve) => {
      finishPlacement = resolve;
    });
  });
  try {
    const panel = { kind: "placement" as const, id: "notes", extensionId };
    workbench.modePlacements.registerPlacement({
      id: "notes",
      ref: panel,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "note" }],
          view: { kind: "view", id: "note" },
          cardinality: "many",
        },
      },
    });
    open({ type: "note", id: "a", extensionId, projectId });
    await settle();
    const resource = { type: "note", id: "b", extensionId, projectId, label: "Saved title" };
    workbench.modePlacements.openPlacement({ panel, resource, open: "pin" });
    await settle();
    expect(requestedPlacement).toBe(true);
    workbench.closePlacement(workbench.layout.getActivePanel("side")!.placementIdentity!);

    open(resource);
    await settle();
    expect(workbench.getPrimaryResource()).toMatchObject({ label: "Current title", metadata: { writable: false } });

    finishPlacement({ ...resource, label: "Stale title", metadata: { writable: true } });
    await settle();

    expect(workbench.getPrimaryResource()).toMatchObject({ label: "Current title", metadata: { writable: false } });
    expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
  } finally {
    dispose();
  }
});

test("unchanged background resource resolutions leave panels and pages stable", async () => {
  const { workbench, open, dispose } = openNoteWorkbench((resource) => resource);
  try {
    const panel = { kind: "placement" as const, id: "notes", extensionId };
    workbench.modePlacements.registerPlacement({
      id: "notes",
      ref: panel,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "note" }],
          view: { kind: "view", id: "note" },
          cardinality: "many",
        },
      },
    });
    open({ type: "note", id: "a", extensionId, projectId });
    workbench.modePlacements.openPlacement({
      panel,
      resource: { type: "note", id: "b", extensionId, projectId, label: "Background" },
      open: "pin",
    });
    await settle();
    const state = workbench.pages.store.getState();
    const layout = workbench.layout.getLayout();
    publishExtensionEvent({ id: `${extensionId}.event.notes.changed`, projectId });
    await settle();
    expect(workbench.pages.store.getState()).toBe(state);
    expect(workbench.layout.getLayout()).toBe(layout);
  } finally {
    dispose();
  }
});

test("an unchanged primary reference still repairs a stale duplicate panel", async () => {
  const { workbench, open, dispose } = openNoteWorkbench((resource) => ({
    ...resource,
    label: "Current",
    metadata: { writable: false },
  }));
  try {
    const panel = { kind: "placement" as const, id: "notes", extensionId };
    workbench.modePlacements.registerPlacement({
      id: "notes",
      ref: panel,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "note" }],
          view: { kind: "view", id: "note" },
          cardinality: "many",
        },
      },
    });
    open({ type: "note", id: "a", extensionId, projectId });
    await settle();
    workbench.modePlacements.openPlacement({
      panel,
      resource: { type: "note", id: "a", extensionId, projectId, label: "Stale", metadata: { writable: true } },
      open: "pin",
    });
    await settle();
    publishExtensionEvent({ id: `${extensionId}.event.notes.changed`, projectId });
    await settle();
    expect(workbench.getPrimaryResource()).toMatchObject({ label: "Current", metadata: { writable: false } });
    expect(workbench.layout.getLayout().regions.side.widgets[0]?.resource).toMatchObject({
      label: "Current",
      metadata: { writable: false },
    });
  } finally {
    dispose();
  }
});
