import type { JsonObject, ParamObjectSchema } from "pstdio-api-contracts/extension-kernel";
import { resolveDeclaredParams } from "pstdio-extensions";
import type { WorkspacesRouteDeps } from "./deps";
import { discoverWorkspaceProvider } from "./workspace-provider-discovery";
import { rootProviderId } from "./workspace-provider-identity";
import {
  findWorkspaceProvider,
  runWorkspaceProviderOperation,
  type WorkspaceProviderHandle,
} from "./workspace-provider-runtime";

export class InvalidWorkspaceParamsError extends Error {}

export const resolveWorkspaceParams = async (
  deps: WorkspacesRouteDeps,
  projectId: string,
  providerId: string,
  input: JsonObject,
  options: { signal?: AbortSignal } = {},
) => {
  let schema: ParamObjectSchema;
  if (providerId === rootProviderId) schema = { path: { type: "text", label: "Project folder" } };
  else {
    const handle = await findWorkspaceProvider(deps, { projectId, providerId });
    if (!handle) throw new InvalidWorkspaceParamsError(`Workspace provider is unavailable: ${providerId}`);
    return validateProviderWorkspaceParams(handle, providerId, input, options);
  }
  return validateWorkspaceParams(providerId, schema, input);
};

const validateProviderWorkspaceParams = async (
  handle: WorkspaceProviderHandle,
  providerId: string,
  input: JsonObject,
  options: { signal?: AbortSignal },
) => {
  const discovery = await discoverWorkspaceProvider(handle, options);
  if (!discovery) throw new InvalidWorkspaceParamsError(`Workspace provider is unavailable: ${providerId}`);
  const params = validateWorkspaceParams(providerId, discovery.params, input);
  if (handle.provider.validateParams) {
    await runWorkspaceProviderOperation(
      handle,
      async (ctx, signal) => {
        try {
          await handle.provider.validateParams!(ctx, params);
        } catch (cause) {
          options.signal?.throwIfAborted();
          signal.throwIfAborted();
          throw new InvalidWorkspaceParamsError(
            `Invalid params for workspace provider "${providerId}": ${cause instanceof Error ? cause.message : String(cause)}`,
            { cause },
          );
        }
      },
      options,
    );
  }
  options.signal?.throwIfAborted();
  return params;
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
