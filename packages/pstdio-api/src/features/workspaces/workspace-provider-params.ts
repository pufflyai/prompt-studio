import type { JsonObject, ParamObjectSchema } from "pstdio-api-contracts/extension-kernel";
import { resolveDeclaredParams } from "pstdio-extensions";
import { git } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";
import { findWorktreeProvider } from "./workspace-provider-catalog";
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
    if (typeof input.base === "string") {
      schema = { base: { type: "text", label: "Base branch", required: true } };
      validateWorkspaceParams(providerId, schema, input);
      const home = await deps.workspaceService.getDefault(projectId);
      if (home?.execution_kind !== "local" || !home.root_path) {
        throw new InvalidWorkspaceParamsError(`Workspace provider is unavailable: ${providerId}`);
      }
      try {
        await git(home.root_path, ["rev-parse", "--verify", "--end-of-options", `${input.base}^{commit}`]);
      } catch (cause) {
        throw new InvalidWorkspaceParamsError(
          `Invalid params for workspace provider "${providerId}": base "${input.base}" must resolve to a valid Git commit.`,
          { cause },
        );
      }
    } else {
      const provider = await findWorktreeProvider(deps, projectId);
      if (!provider) throw new InvalidWorkspaceParamsError(`Workspace provider is unavailable: ${providerId}`);
      schema = provider.params;
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
