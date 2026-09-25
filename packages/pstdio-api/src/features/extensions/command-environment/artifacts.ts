import type { CommandRunnerEnvironment, RuntimeArtifactMount } from "pstdio-extensions";
import { createArtifactMount } from "pstdio-extensions";
import type { FileAccess } from "./workspace-files";

export const createArtifactsApi = (
  resolveProjectPath: (access: FileAccess) => Promise<string>,
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

  const createForDefaultWorkspace = async (mount: RuntimeArtifactMount, access: FileAccess) => {
    const rootPath = await resolveProjectPath(access);
    return createArtifactMount({ repoRoot: rootPath, name: mount.name, mountPath: mount.relativePath });
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
