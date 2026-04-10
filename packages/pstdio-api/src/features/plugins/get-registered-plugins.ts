import type { RouteDeps } from "../deps";

export const getRegisteredPlugins = async (deps: Pick<RouteDeps, "pluginService">, projectId: string) => {
  const runtime = await deps.pluginService.getForProject(projectId);
  const pluginsDir = runtime.repoPath ? `${runtime.repoPath}/.pstdio/plugins` : null;

  return {
    plugins: runtime.plugins,
    pluginsDir,
  };
};
