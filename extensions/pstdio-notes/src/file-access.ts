import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const notesFileAccess = async (ctx: Pick<ExtensionContextBase, "workspaces">) => {
  const workspace = await ctx.workspaces.getDefault();
  const ready =
    workspace?.execution_kind === "local" &&
    Boolean(workspace.root_path) &&
    workspace.provider_state === "ready" &&
    !workspace.initializing &&
    !workspace.setup_error;
  const files = workspace?.provider_capabilities_json?.files;
  return {
    readable: ready && (files === "read" || files === "write"),
    writable: ready && files === "write",
  };
};
