import type { ExtensionResourcesApi } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../deps";

export const createResourcesApi = (
  deps: Pick<ExtensionsRouteDeps, "extensionRuntimeCatalog" | "extensionResourceSequencesService" | "eventBus">,
  input: { projectId: string; extensionId: string },
): ExtensionResourcesApi => ({
  removed: async (resource) => {
    if (resource.projectId && resource.projectId !== input.projectId)
      throw new Error("Resource belongs to another project.");
    if (resource.extensionId && resource.extensionId !== input.extensionId)
      throw new Error("Resource belongs to another extension.");
    const { runtime } = await deps.extensionRuntimeCatalog.get(input.projectId);
    const declaration = runtime.resourceKinds.find(
      (record) => record.extensionId === input.extensionId && record.localId === resource.type,
    );
    if (!declaration) throw new Error(`Resource kind "${resource.type}" is not owned by ${input.extensionId}.`);
    deps.eventBus.emit("resource_events", "set", {
      id: crypto.randomUUID(),
      resource: { ...resource, extensionId: input.extensionId, projectId: input.projectId },
    });
  },
  allocate: async ({ kind }) => {
    const { runtime, project } = await deps.extensionRuntimeCatalog.get(input.projectId);
    const declaration = runtime.resourceKinds.find(
      (record) => record.extensionId === input.extensionId && record.localId === kind,
    );
    const prefix = declaration?.contribution.prefix;
    if (prefix === undefined)
      throw new Error(`Resource kind "${kind}" has no allocation prefix in ${input.extensionId}.`);
    const resolved = typeof prefix === "string" ? prefix : project.shorthand;
    if (!/^[A-Z][A-Z0-9]{0,15}$/.test(resolved) || resolved === "WS")
      throw new Error(`Resource prefix "${resolved}" is invalid or reserved.`);
    return deps.extensionResourceSequencesService.allocate({ ...input, kind, prefix: resolved });
  },
});
