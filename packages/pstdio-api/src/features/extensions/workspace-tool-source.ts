import { loadExtensionSource } from "./extension-runtime";

export const combinedWorkspacesSource = async (sourcePath: string) => {
  const loaded = await loadExtensionSource(sourcePath, { accepted: true });
  const providers = loaded.definition.workspaceTypes;
  return (
    Array.isArray(providers) &&
    providers.some(
      (provider) => typeof provider === "object" && provider !== null && "id" in provider && provider.id === "git",
    )
  );
};
