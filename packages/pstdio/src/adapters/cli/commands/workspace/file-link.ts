import { posix } from "node:path";
import { defaultPageResourceCodec, serializeWorkbenchPageUrl } from "pstdio-api-contracts";
import type { Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { listWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "file-link";
export const describe = "Print a workspace file's dashboard link";
export const builder = (yargs: Argv) =>
  yargs
    .option("workspace", { type: "string", demandOption: true, describe: "Workspace shorthand or UUID" })
    .option("path", { type: "string", demandOption: true, describe: "Workspace-root relative file path" })
    .option("line", { type: "number", describe: "One-based source line" })
    .option("column", { type: "number", describe: "One-based source column" });

interface FileLinkInput {
  workspace: string;
  path: string;
  line?: number;
  column?: number;
}
const defaultDeps = {
  cwd: () => process.cwd(),
  findProjectRoot,
  readConfig,
  listWorkspaces,
  log: console.log,
  openings: (
    projectId: string,
    resources: Parameters<ReturnType<typeof apiClient>["projects"]["resolveResourceOpenings"]>[1],
  ) => apiClient().projects.resolveResourceOpenings(projectId, resources),
  pages: async (projectId: string) =>
    (await apiClient().extensions.metadata(projectId)).pages.map((page) => ({
      id: page.id,
      path: page.path,
      document: page.document,
      params: page.params,
      ref: { kind: "page" as const, extensionId: page.extensionId, id: page.localId },
    })),
};

export const createHandler =
  (deps = defaultDeps) =>
  async (input: FileLinkInput) => {
    const root = deps.findProjectRoot(deps.cwd());
    const config = root ? deps.readConfig(root) : null;
    if (!config) throw new Error("Not inside a pstdio project.");
    const path = posix.normalize(input.path.replaceAll("\\", "/"));
    if (
      path === "." ||
      path === ".." ||
      path.startsWith("../") ||
      path.startsWith("/") ||
      /^[a-z]:/i.test(path) ||
      path.includes("\0")
    )
      throw new Error("Use a file path inside the workspace root.");
    if (input.column !== undefined && input.line === undefined) throw new Error("A source column requires a line.");
    const workspace = (await deps.listWorkspaces(config.project_id)).find(
      (workspace) => workspace.id === input.workspace || workspace.workspace_shorthand === input.workspace,
    );
    if (!workspace) throw new Error(`Workspace not found: ${input.workspace}`);
    const [openings, pages] = await Promise.all([
      deps.openings(config.project_id, [
        {
          type: "workspace",
          extensionId: "pstdio",
          projectId: config.project_id,
          id: workspace.id,
          metadata: { workspaceFilePath: path },
        },
      ]),
      deps.pages(config.project_id),
    ]);
    const target = openings[0]?.target;
    if (target?.kind !== "page") throw new Error("The configured workspace file opener is unavailable.");
    const href = serializeWorkbenchPageUrl({
      projectId: config.project_id,
      pages,
      resources: defaultPageResourceCodec,
      location: {
        ...target,
        ...(input.line !== undefined
          ? { position: { line: input.line, ...(input.column !== undefined ? { column: input.column } : {}) } }
          : {}),
      },
    });
    deps.log(JSON.stringify({ href }));
  };
export const handler = createHandler();
