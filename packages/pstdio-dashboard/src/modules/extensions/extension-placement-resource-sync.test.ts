import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench";
import { extensionId, openNoteWorkbench, projectId, settle } from "./extension-resource-sync.fixture";

test("a pending placement refresh cannot overwrite the newer primary resource", async () => {
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

    open(resource);
    await settle();
    expect(workbench.getPrimaryResource()).toMatchObject({ label: "Current title", metadata: { writable: false } });

    finishPlacement({ ...resource, label: "Stale title", metadata: { writable: true } });
    await settle();

    expect(workbench.getPrimaryResource()).toMatchObject({ label: "Current title", metadata: { writable: false } });
    const side = workbench.layout.getLayout().regions.side.widgets.find((widget) => widget.resource?.id === "b");
    expect(side?.resource).toMatchObject({ label: "Current title", metadata: { writable: false } });
  } finally {
    dispose();
  }
});
