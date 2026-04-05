import { createClient } from "@pstdio/sdk/client";
import { ensurePluginWorkspace } from "pstdio-plugins";
import { createPluginRuntimeStore } from "pstdio-plugins/hooks";

type PluginServiceDeps = {
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> };
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
};

export const createPluginService = (deps: PluginServiceDeps) =>
  createPluginRuntimeStore({
    resolveRepoPath: async (projectId) => {
      const repos = await deps.repoService.listByProject(projectId);
      return repos[0]?.path ?? null;
    },
    createClient: () => createClient(),
    ensureWorkspace: deps.ensureWorkspace ?? ensurePluginWorkspace,
  });
