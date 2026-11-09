import type { WorkspaceProviderHandle } from "./workspace-provider-runtime";
import { runWorkspaceProviderOperation } from "./workspace-provider-runtime";

export const discoverWorkspaceProvider = async (
  handle: WorkspaceProviderHandle,
  options: { signal?: AbortSignal } = {},
) => {
  const discovery = handle.provider.discover
    ? await runWorkspaceProviderOperation(handle, (ctx) => handle.provider.discover!(ctx), options)
    : {};
  if (discovery === null) return null;
  const params = discovery.params ?? handle.provider.params ?? {};
  return { params: handle.normalizeParams ? handle.normalizeParams(params) : params };
};
