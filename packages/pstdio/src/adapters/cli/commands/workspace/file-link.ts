import { posix } from "node:path";
import { serializePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
import type { Argv } from "yargs";
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
const defaultDeps = { cwd: () => process.cwd(), findProjectRoot, readConfig, listWorkspaces, log: console.log };

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
    const href = serializePageUrl({
      projectId: config.project_id,
      page: {
        id: "workspace",
        ref: workbenchPages.workspace,
        path: "workspace",
        document: { metadataKey: "workspaceFilePath" },
      },
      resource: { type: "workspace", id: workspace.id, metadata: { workspaceFilePath: path } },
      position:
        input.line !== undefined
          ? { line: input.line, ...(input.column !== undefined ? { column: input.column } : {}) }
          : undefined,
    });
    deps.log(JSON.stringify({ href }));
  };
export const handler = createHandler();
