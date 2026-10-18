import type { CommandRunnerEnvironment, RuntimeArtifactMount } from "pstdio-extensions";
import { createReadBoundary } from "pstdio-extensions";
import { createSharedArtifactMount } from "../../../services/shared-files/artifact-mount";
import type { ExtensionsRouteDeps } from "../deps";
import type { FileAccess } from "./workspace-files";

export const createArtifactsApi = (
  resolveProjectPath: (access: FileAccess) => Promise<string>,
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    onWrite: (path: string) => void;
    projectId: string;
    signal?: AbortSignal;
  },
  deps: Pick<ExtensionsRouteDeps, "extensionStorageService" | "assetTransferService">,
): CommandRunnerEnvironment["artifacts"] => {
  const resolveMount = (key: string) => {
    const mount = (input.artifactMounts ?? []).find(
      (candidate) => candidate.extensionId === input.extensionId && (candidate.localId === key || candidate.id === key),
    );
    if (!mount) throw new Error(`Artifact mount not found: ${key}`);
    return mount;
  };

  const createForDefaultWorkspace = async (mount: RuntimeArtifactMount, access: FileAccess) => {
    const root =
      access === "read"
        ? await createReadBoundary(input.signal)(() => resolveProjectPath(access))
        : await resolveProjectPath(access);
    return createSharedArtifactMount(deps, {
      projectId: input.projectId,
      extensionId: input.extensionId,
      repoRoot: root,
      name: mount.name,
      mountPath: mount.relativePath,
      mountPaths: (input.artifactMounts ?? [])
        .filter((candidate) => candidate.extensionId === input.extensionId)
        .map((candidate) => candidate.relativePath),
      signal: access === "read" ? input.signal : undefined,
      onWrite: input.onWrite,
      resolveWriteRoot: () => resolveProjectPath("write"),
    });
  };

  return {
    mount(key) {
      const mount = resolveMount(key);
      const mountFor = (access: FileAccess) => createForDefaultWorkspace(mount, access);

      return {
        exists: async (path) => (await mountFor("read")).exists(path),
        readText: async (path) => (await mountFor("read")).readText(path),
        writeText: async (path, value) => (await mountFor("write")).writeText(path, value),
        updateText: async (path, value) => (await mountFor("write")).updateText(path, value),
        readBytes: async (path) => (await mountFor("read")).readBytes(path),
        writeBytes: async (path, value) => (await mountFor("write")).writeBytes(path, value),
        list: async (pattern) => (await mountFor("read")).list(pattern),
        listDirs: async (path) => (await mountFor("read")).listDirs(path),
        delete: async (path) => (await mountFor("write")).delete(path),
      };
    },
  };
};
