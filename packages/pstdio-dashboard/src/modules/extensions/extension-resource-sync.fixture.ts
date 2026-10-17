import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { watchOpenExtensionResource } from "./extension-resource-sync";

export const projectId = "extension-resource-sync";
export const extensionId = "acme.notes";
const resolveCommand = `${extensionId}.command.resolve-note`;
export const page = { kind: "page" as const, extensionId, id: "note" };
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export const openNoteWorkbench = (
  resolve: (resource: ResourceRef) => Promise<ResourceRef | null> | ResourceRef | null,
  batchResolver = false,
  batchOnly = false,
) => {
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
  const subscription = watchOpenExtensionResource(workbench, {
    projectId,
    metadata: {
      ...emptyDashboardExtensionMetadata,
      resourceKinds: [
        {
          id: "note",
          localId: "note",
          extensionId,
          resolveCommand: batchOnly ? undefined : resolveCommand,
          ...(batchResolver || batchOnly ? { resolveManyCommand: `${extensionId}.command.resolve-links` } : {}),
          menuSlots: [],
        },
      ],
    },
    executeCommand: async (_projectId, commandId, body) => {
      const resource = (body as { resource: ResourceRef }).resource;
      resolved.push(resource);
      const value = await resolve(resource);
      return {
        commandId,
        extensionId,
        outcome: { ok: true, status: "success", value: batchOnly ? [{ resource: value }] : value },
      } as CommandExecuteResponse;
    },
  });
  workbench.pageLocations.setProject(projectId);
  const open = (resource: ResourceRef) => workbench.pageLocations.navigate({ kind: "page", page, resource });
  return { workbench, open, resolved, dispose: () => subscription.dispose() };
};
