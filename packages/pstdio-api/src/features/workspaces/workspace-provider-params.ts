import type { JsonObject, ParamObjectSchema } from "pstdio-api-contracts/extension-kernel";
import { resolveDeclaredParams } from "pstdio-extensions";
import { git } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";
import { listWorkspaceProviders } from "./workspace-provider-catalog";
import { rootProviderId, worktreeProviderId } from "./workspace-provider-identity";
import { findWorkspaceProvider } from "./workspace-provider-runtime";

export class InvalidWorkspaceParamsError extends Error {}

export const resolveWorkspaceParams = async (
  deps: WorkspacesRouteDeps,
  projectId: string,
  providerId: string,
  input: JsonObject,
) => {
  let schema: ParamObjectSchema;
  if (providerId === rootProviderId) schema = { path: { type: "text", label: "Project folder" } };
  else if (providerId === worktreeProviderId) {
    const provider = (await listWorkspaceProviders(deps, projectId)).find((provider) => provider.id === providerId);
    if (!provider) throw new InvalidWorkspaceParamsError(`Workspace provider is unavailable: ${providerId}`);
    schema = provider.params;
    const base = schema.base;
    if (
      base.type === "select" &&
      Array.isArray(base.options) &&
      typeof input.base === "string" &&
      !base.options.some((option) => option.value === input.base)
    ) {
      const home = await deps.workspaceService.getDefault(projectId);
      try {
        await git(home!.root_path!, ["rev-parse", "--verify", "--end-of-options", `${input.base}^{commit}`]);
        schema = { ...schema, base: { ...base, options: [...base.options, { label: input.base, value: input.base }] } };
      } catch {
        /* The declared options below describe valid branch choices. */
      }
    }
  } else {
    const handle = await findWorkspaceProvider(deps, { projectId, providerId });
    // Missing providers retain their recoverable operation. Validate when they become available.
    if (!handle) return input;
    schema = handle.provider.params ?? {};
  }
  return validateWorkspaceParams(providerId, schema, input);
};

export const validateWorkspaceParams = (providerId: string, schema: ParamObjectSchema, input: JsonObject) => {
  try {
    return resolveDeclaredParams(schema, input) as JsonObject;
  } catch (error) {
    const accepted =
      Object.entries(schema)
        .map(([key, descriptor]) => {
          const options =
            (descriptor.type === "select" || descriptor.type === "multi-select") && Array.isArray(descriptor.options)
              ? ` (${descriptor.options.map((option) => option.value).join(", ")})`
              : ` (${descriptor.type})`;
          return `${key}${options}`;
        })
        .join("; ") || "none";
    throw new InvalidWorkspaceParamsError(
      `Invalid params for workspace provider "${providerId}": ${error instanceof Error ? error.message : String(error)}. Accepted params: ${accepted}`,
    );
  }
};
