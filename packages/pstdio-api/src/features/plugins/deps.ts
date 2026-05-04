import type { RouteDeps } from "../deps";

export type PluginsRouteDeps = Pick<RouteDeps, "filesRoot" | "pluginService" | "projectService" | "repoService">;
