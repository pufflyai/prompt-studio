import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type ClientOptions, createClient } from "@pstdio/sdk/client";
import { ensurePluginWorkspace } from "pstdio-plugins";
import { createPluginRuntimeStore } from "pstdio-plugins/hooks";
import type { CronFactory } from "pstdio-scheduler";
import { scaffoldBundledPlugins } from "../projects/scaffold-bundled-plugins";
import { createPluginScheduler } from "./plugin-scheduler";

const SCHEDULE_WATERMARK_FILE = "plugin-schedule-watermarks.json";

type PluginServiceDeps = {
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> };
  listProjectIds: () => Promise<string[]>;
  filesRoot: string;
  storageRoot: string;
  ensureWorkspace?: (pstdioDir: string) => Promise<void>;
  clientOptions?: ClientOptions;
  now?: () => Date;
  cron?: CronFactory;
};

const resolveProjectPluginWorkspacePath = async (deps: PluginServiceDeps, projectId: string) => {
  if (!deps.filesRoot) return null;

  const workspacePath = join(deps.storageRoot, "plugin-workspaces", projectId);
  await mkdir(workspacePath, { recursive: true });
  await scaffoldBundledPlugins(workspacePath, join(deps.filesRoot, "plugins", "pstdio"));
  return workspacePath;
};

export const createPluginService = (deps: PluginServiceDeps) => {
  const runtimeStore = createPluginRuntimeStore({
    resolveRepoPath: async (projectId) => {
      const repos = await deps.repoService.listByProject(projectId);
      if (repos[0]?.path) return repos[0].path;

      return resolveProjectPluginWorkspacePath(deps, projectId);
    },
    createClient: () => createClient(deps.clientOptions),
    ensureWorkspace: deps.ensureWorkspace ?? ensurePluginWorkspace,
  });

  const scheduler = createPluginScheduler({
    runtimeStore,
    listProjectIds: deps.listProjectIds,
    now: deps.now,
    cron: deps.cron,
    watermarkPath: join(deps.storageRoot, SCHEDULE_WATERMARK_FILE),
  });

  return {
    ...runtimeStore,
    refresh: scheduler.refresh,
    async dispose() {
      await scheduler.dispose();
      runtimeStore.dispose();
    },
  };
};
