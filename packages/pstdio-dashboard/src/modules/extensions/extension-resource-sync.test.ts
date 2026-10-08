import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { watchOpenExtensionResource } from "./extension-resource-sync";

const projectId = "extension-resource-sync";
const extensionId = "acme.notes";
const resolveCommand = `${extensionId}.command.resolve-note`;
const page = { kind: "page" as const, extensionId, id: "note" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const openNoteWorkbench = (resolve: (resource: ResourceRef) => Promise<ResourceRef | null> | ResourceRef | null) => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "note", title: "Note", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "note",
    ref: page,
    path: "note",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: { kind: "panels", empty: { kind: "view", id: "note" } },
    slots: [],
  });
  const resolved: ResourceRef[] = [];
  watchOpenExtensionResource(workbench, {
    projectId,
    metadata: {
      ...emptyDashboardExtensionMetadata,
      resourceKinds: [{ id: "note", localId: "note", extensionId, resolveCommand, menuSlots: [] }],
    },
    executeCommand: async (_projectId, commandId, body) => {
      const resource = (body as { resource: ResourceRef }).resource;
      resolved.push(resource);
      return {
        commandId,
        extensionId,
        outcome: { ok: true, status: "success", value: await resolve(resource) },
      } as CommandExecuteResponse;
    },
  });
  workbench.pageLocations.setProject(projectId);
  const open = (resource: ResourceRef) => workbench.pageLocations.navigate({ kind: "page", page, resource });
  return { workbench, open, resolved };
};

describe("open extension resource sync", () => {
  test("shows the extension's current reference for the open resource", async () => {
    const { workbench, open, resolved } = openNoteWorkbench((resource) => ({
      ...resource,
      label: "Current title",
      metadata: { ...resource.metadata, archived: true },
    }));

    open({ type: "note", id: "n1", label: "Saved title", metadata: { documentId: "body" } });
    await settle();

    expect(resolved).toEqual([expect.objectContaining({ type: "note", id: "n1", metadata: { documentId: "body" } })]);
    expect(workbench.getPrimaryResource()).toMatchObject({
      label: "Current title",
      metadata: { documentId: "body", archived: true },
    });
  });

  test("keeps the open resource's identity when the resolver leaves it out", async () => {
    const { workbench, open } = openNoteWorkbench((resource) => ({
      type: resource.type,
      id: resource.id,
      label: "Renamed",
    }));

    open({ type: "note", id: "n1", extensionId, projectId, label: "Saved title" });
    await settle();

    expect(workbench.getPrimaryResource()).toMatchObject({ id: "n1", extensionId, projectId, label: "Renamed" });
  });

  test("resolves the open resource again after its extension emits an event", async () => {
    let archived = false;
    const { workbench, open, resolved } = openNoteWorkbench((resource) => ({ ...resource, metadata: { archived } }));
    open({ type: "note", id: "n1" });
    await settle();

    archived = true;
    publishExtensionEvent({ id: `${extensionId}.event.notes.changed`, projectId });
    await settle();

    expect(resolved).toHaveLength(2);
    expect(workbench.getPrimaryResource()?.metadata).toMatchObject({ archived: true });
  });

  test("drops a result for a resource that is no longer open", async () => {
    let finishFirst: (value: ResourceRef) => void = () => undefined;
    const { workbench, open } = openNoteWorkbench((resource) =>
      resource.id === "n1"
        ? new Promise<ResourceRef>((resolve) => {
            finishFirst = resolve;
          })
        : resource,
    );
    open({ type: "note", id: "n1", label: "First" });
    await settle();
    open({ type: "note", id: "n2", label: "Second" });
    await settle();

    finishFirst({ type: "note", id: "n1", label: "First, renamed" });
    await settle();

    expect(workbench.getPrimaryResource()).toMatchObject({ id: "n2", label: "Second" });
  });
});

test("same-kind open resources resolve through their own extension and refresh when the owner changes", async () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "note", title: "Note", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "note",
    ref: page,
    path: "note",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: { kind: "panels", empty: { kind: "view", id: "note" } },
    slots: [],
  });
  const calls: string[] = [];
  const owners = ["acme.notes", "acme.art"];
  watchOpenExtensionResource(workbench, {
    projectId,
    metadata: {
      resourceKinds: owners.map((extensionId) => ({
        id: "note",
        localId: "note",
        extensionId,
        resolveCommand: extensionId + ".command.resolve",
        menuSlots: [],
      })),
    },
    executeCommand: async (_project, commandId, body) => {
      calls.push(commandId);
      const resource = (body as { resource: ResourceRef }).resource;
      return {
        commandId,
        extensionId: resource.extensionId,
        outcome: { ok: true, status: "success", value: { ...resource, label: commandId } },
      } as CommandExecuteResponse;
    },
  });
  workbench.pageLocations.setProject(projectId);
  for (const extensionId of owners) {
    workbench.pageLocations.navigate({
      kind: "page",
      page,
      resource: { type: "note", id: "same", projectId, extensionId },
    });
    await settle();
    expect(workbench.getPrimaryResource()?.label).toBe(extensionId + ".command.resolve");
  }
  expect(calls).toEqual(owners.map((owner) => owner + ".command.resolve"));
});
