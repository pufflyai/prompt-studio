import { type InstalledExtensionSource, toExtensionEnableInput } from "./install-extension-source";

export const registerInstalledExtensionSources = async (
  extensionService: {
    registerInstalledSource: (input: {
      displayName: string;
      extensionId: string;
      installName: string;
      manifest: Record<string, unknown>;
      name: string;
      sourceHash: string;
      sourceKind: "git" | "local_path";
      sourcePath: string;
      sourceRef: string | null;
      version: string | null;
    }) => Promise<unknown>;
  },
  installed: InstalledExtensionSource[],
) => {
  for (const extension of installed) {
    await extensionService.registerInstalledSource({
      installName: extension.installName,
      ...toExtensionEnableInput(extension),
    });
  }
};
