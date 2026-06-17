import type { CommandRunnerEnvironment, RuntimeArtifactMount } from "pstdio-extensions";
import { createArtifactMount } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createArtifactsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    projectId: string;
  },
): CommandRunnerEnvironment["artifacts"] => {
  const resolveMount = (key: string) => {
    const mount = (input.artifactMounts ?? []).find(
      (candidate) => candidate.extensionId === input.extensionId && (candidate.localId === key || candidate.id === key),
    );
    if (!mount) throw new Error(`Artifact mount not found: ${key}`);
    return mount;
  };

  const createForDefaultRepo = async (mount: RuntimeArtifactMount) => {
    const [repo] = await deps.repoService.listByProject(input.projectId);
    if (!repo) throw new Error(`Repo not found for project: ${input.projectId}`);
    return createArtifactMount({ repoRoot: repo.path, name: mount.name, mountPath: mount.relativePath });
  };

  return {
    mount(key) {
      const mount = resolveMount(key);
      const mountFor = () => createForDefaultRepo(mount);

      return {
        exists: async (path) => (await mountFor()).exists(path),
        readText: async (path) => (await mountFor()).readText(path),
        writeText: async (path, value) => (await mountFor()).writeText(path, value),
        readBytes: async (path) => (await mountFor()).readBytes(path),
        writeBytes: async (path, value) => (await mountFor()).writeBytes(path, value),
        list: async (pattern) => (await mountFor()).list(pattern),
        listDirs: async (path) => (await mountFor()).listDirs(path),
        delete: async (path) => (await mountFor()).delete(path),
      };
    },
  };
};
