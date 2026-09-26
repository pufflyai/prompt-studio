import type { CommandRunnerEnvironment, RuntimeArtifactMount } from "pstdio-extensions";
import { createArtifactMount, createReadBoundary } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createArtifactsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    projectId: string;
    signal?: AbortSignal;
  },
): CommandRunnerEnvironment["artifacts"] => {
  const resolveMount = (key: string) => {
    const mount = (input.artifactMounts ?? []).find(
      (candidate) => candidate.extensionId === input.extensionId && (candidate.localId === key || candidate.id === key),
    );
    if (!mount) throw new Error(`Artifact mount not found: ${key}`);
    return mount;
  };

  const createForDefaultRepo = async (mount: RuntimeArtifactMount, signal?: AbortSignal) => {
    const [repo] = await createReadBoundary(signal)(() => deps.repoService.listByProject(input.projectId));
    if (!repo) throw new Error(`Repo not found for project: ${input.projectId}`);
    return createArtifactMount({
      repoRoot: repo.path,
      name: mount.name,
      mountPath: mount.relativePath,
      signal: input.signal,
    });
  };

  return {
    mount(key) {
      const mount = resolveMount(key);
      const mountFor = (signal?: AbortSignal) => createForDefaultRepo(mount, signal);

      return {
        exists: async (path) => (await mountFor(input.signal)).exists(path),
        readText: async (path) => (await mountFor(input.signal)).readText(path),
        writeText: async (path, value) => (await mountFor()).writeText(path, value),
        updateText: async (path, value) => (await mountFor()).updateText(path, value),
        readBytes: async (path) => (await mountFor(input.signal)).readBytes(path),
        writeBytes: async (path, value) => (await mountFor()).writeBytes(path, value),
        list: async (pattern) => (await mountFor(input.signal)).list(pattern),
        listDirs: async (path) => (await mountFor(input.signal)).listDirs(path),
        delete: async (path) => (await mountFor()).delete(path),
      };
    },
  };
};
