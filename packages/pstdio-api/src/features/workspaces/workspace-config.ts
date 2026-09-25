import { lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ExtensionEventDeps } from "../extensions/extension-event-runtime";

type Config = Record<string, unknown> & { project_id: string; workspace_id?: string };
type ConfigDeps = Pick<ExtensionEventDeps, "workspaceService">;
const configPath = (dir: string) => join(dir, ".pstdio", "config.json");
const missing = (error: unknown) => ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "");
const findSymlink = async (...paths: string[]) => {
  for (const path of paths) {
    try {
      if ((await lstat(path)).isSymbolicLink()) return path;
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return null;
};
const rejectSymlinks = async (...paths: string[]) => {
  const path = await findSymlink(...paths);
  if (path) throw new Error(`Workspace metadata must not use a symlink: ${path}`);
};
const readConfig = async (path: string) => {
  await rejectSymlinks(dirname(path), path);
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
  try {
    const value = JSON.parse(content);
    if (typeof value?.project_id !== "string") return null;
    if (value.workspace_id !== undefined && typeof value.workspace_id !== "string") return null;
    return value as Config;
  } catch {
    return null;
  }
};
const ensureConfigGitignore = async (dir: string) => {
  const path = join(dir, ".pstdio", ".gitignore");
  let content = "";
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (!missing(error)) throw error;
  }
  if (!content.split(/\r?\n/).includes("config.json"))
    await writeFile(path, `${content}${content && !content.endsWith("\n") ? "\n" : ""}config.json\n`);
};
const canReplaceConfig = async (deps: ConfigDeps, base: Config, dir: string, workspaceId: string) => {
  const previous = base.workspace_id
    ? await deps.workspaceService.get(base.workspace_id)
    : await deps.workspaceService.getDefault(base.project_id);
  if (!previous || previous.project_id !== base.project_id) return false;
  const workspaces = await deps.workspaceService.listForProviderReconciliation(base.project_id);
  const folder = await realpath(dir);
  // A worktree is a valid owner even though its project's default folder is elsewhere.
  for (const workspace of workspaces) {
    if (workspace.id === workspaceId || !workspace.root_path) continue;
    try {
      if ((await realpath(workspace.root_path)) === folder) return false;
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return true;
};

export const ensureWorkspaceConfig = async (
  workspaceDir: string,
  projectDir: string,
  workspaceId: string,
  projectId: string,
  deps: ConfigDeps,
) => {
  const dst = configPath(workspaceDir);
  await rejectSymlinks(dirname(dst), dst, join(workspaceDir, ".pstdio", ".gitignore"));
  const source = workspaceDir === projectDir ? null : await readConfig(configPath(projectDir));
  const template = source?.project_id === projectId ? source : {};
  const identity = { project_id: projectId, workspace_id: workspaceId };
  await mkdir(join(workspaceDir, ".pstdio"), { recursive: true });
  try {
    // The config is shared by independent hosts, so the first claim must be exclusive.
    await writeFile(dst, `${JSON.stringify({ ...template, ...identity }, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const base = await readConfig(dst);
    const matches = base?.project_id === projectId && base.workspace_id === workspaceId;
    if (!matches) {
      if (!base || !(await canReplaceConfig(deps, base, workspaceDir, workspaceId))) {
        throw new Error(
          `The folder config at ${dst} belongs to another workspace or cannot be read. Open it with its owning host, or remove the config to attach this folder here.`,
        );
      }
      await writeFile(dst, `${JSON.stringify({ ...base, ...identity }, null, 2)}\n`);
    }
  }
  await ensureConfigGitignore(workspaceDir);
};

export const removeWorkspaceConfig = async (workspaceDir: string, projectId: string, workspaceId: string) => {
  const path = configPath(workspaceDir);
  if (await findSymlink(dirname(path), path)) return;
  const config = await readConfig(path);
  if (config?.project_id !== projectId) return;
  if (config.workspace_id !== undefined && config.workspace_id !== workspaceId) return;
  await rm(path, { force: true });
};
