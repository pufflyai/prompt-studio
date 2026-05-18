import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const workspaceExtensionSource = resolve(import.meta.dirname, "../../../../extensions/pstdio-core-workspace");

type ExtensionServiceLike = {
  enableInstalledSourceForProject: (input: {
    projectId: string;
    displayName: string;
    extensionId: string;
    installName: string;
    manifest: Record<string, unknown>;
    name: string;
    sourceKind: "local_path";
    sourcePath: string;
    version: string | null;
  }) => Promise<unknown>;
};

/**
 * Registers `pstdio-core-workspace` against the given project pointing at the
 * local source (no copy, no install). The runtime imports the extension from
 * its monorepo workspace location so `@pstdio/sdk` resolves through the linked
 * `node_modules`.
 */
export const enableCoreWorkspaceExtension = async (
  deps: { extensionService: ExtensionServiceLike },
  projectId: string,
) => {
  const manifest = JSON.parse(readFileSync(join(workspaceExtensionSource, "package.json"), "utf-8")) as Record<
    string,
    unknown
  >;
  await deps.extensionService.enableInstalledSourceForProject({
    projectId,
    displayName: (manifest.displayName as string) ?? "Core Workspace",
    extensionId: `${manifest.publisher as string}.${manifest.name as string}`,
    installName: manifest.name as string,
    manifest,
    name: manifest.name as string,
    sourceKind: "local_path",
    sourcePath: workspaceExtensionSource,
    version: (manifest.version as string | undefined) ?? null,
  });
};
