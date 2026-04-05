import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getProject } from "@/features/projects/api/get-project";
import { listRepos } from "@/features/projects/api/list-repos";

export const command = "view";
export const describe = "View project details";

export const builder = (yargs: Argv) => yargs.option("project-id", { type: "string", describe: "Project ID" });

export type ViewArgs = { "project-id"?: string };

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  getProject: typeof getProject;
  listRepos: typeof listRepos;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  getProject,
  listRepos,
  log: console.log,
};

const formatDate = (iso: string) => iso.slice(0, 10);

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ViewArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    const project = await deps.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const repos = await deps.listRepos(projectId);

    const lines = [
      `Name:             ${project.name}`,
      `ID:               ${project.id}`,
      `Shorthand:        ${project.shorthand}`,
      `Created:          ${formatDate(project.created_at)}`,
      `Updated:          ${formatDate(project.updated_at)}`,
      "",
      `Repos:            ${repos.length > 0 ? `${repos.length} linked` : "none"}`,
    ];

    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
