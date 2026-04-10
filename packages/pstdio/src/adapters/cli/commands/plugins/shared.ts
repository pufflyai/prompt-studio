import type { Argv } from "yargs";
import type { findGitRoot, readConfig } from "@/features/config/config";
import type { listPlugins as defaultListPlugins } from "@/features/projects/api/list-plugins";

export const noPluginsMessage = "No plugins registered for this project.";

export type PluginsArgs = {
  "project-id"?: string;
};

type PluginRow = {
  identity: string;
  path: string;
};

type ResolvedPlugins = Awaited<ReturnType<typeof defaultListPlugins>>;

export const addProjectIdOption = (yargs: Argv) =>
  yargs.option("project-id", { type: "string", describe: "Project ID" });

export type ProjectResolutionDeps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
};

export const resolveProjectId = (deps: ProjectResolutionDeps, projectId?: string) => {
  if (projectId) return projectId;

  const root = deps.findGitRoot(deps.cwd());
  if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");

  const config = deps.readConfig(root);
  if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");

  return config.project_id;
};

const formatTable = (rows: PluginRow[]) => {
  const header: PluginRow = { identity: "Identity", path: "Path" };

  const widths = {
    identity: Math.max(header.identity.length, ...rows.map((row) => row.identity.length)),
    path: Math.max(header.path.length, ...rows.map((row) => row.path.length)),
  };

  const pad = (value: string, width: number) => value.padEnd(width);
  const line = (row: PluginRow) => `${pad(row.identity, widths.identity)}   ${pad(row.path, widths.path)}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const formatPluginOutput = (result: ResolvedPlugins) => {
  if (result.plugins.length === 0) return noPluginsMessage;

  const rows = result.plugins.map((plugin) => ({
    identity: plugin.identity,
    path: plugin.filePath,
  }));

  return [result.pluginsDir ? `Plugins directory: ${result.pluginsDir}` : null, formatTable(rows)]
    .filter(Boolean)
    .join("\n\n");
};
