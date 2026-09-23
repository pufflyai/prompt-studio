import type { Arguments, Argv } from "yargs";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { getProject } from "@/features/projects/api/get-project";

export const command = "view";
export const describe = "View project details";

export const builder = (yargs: Argv) => yargs.option("project-id", { type: "string", describe: "Project ID" });

export type ViewArgs = { "project-id"?: string };

type Deps = {
  cwd: () => string;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  getProject: typeof getProject;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findProjectRoot,
  readConfig,
  getProject,
  log: console.log,
};

const formatDate = (iso: string) => iso.slice(0, 10);

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ViewArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findProjectRoot(deps.cwd());
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    const project = await deps.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const lines = [
      `Name:             ${project.name}`,
      `ID:               ${project.id}`,
      `Shorthand:        ${project.shorthand}`,
      `Created:          ${formatDate(project.created_at)}`,
      `Updated:          ${formatDate(project.updated_at)}`,
      "",
    ];

    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
