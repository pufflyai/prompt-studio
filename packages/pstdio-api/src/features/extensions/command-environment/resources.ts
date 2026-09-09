import type { ExtensionResourcesApi } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../deps";

export const createResourcesApi = (
  deps: Pick<ExtensionsRouteDeps, "extensionRuntimeCatalog" | "extensionResourceSequencesService">,
  input: { projectId: string; extensionId: string },
): ExtensionResourcesApi => ({
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
