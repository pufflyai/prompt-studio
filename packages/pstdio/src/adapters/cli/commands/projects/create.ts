import { basename } from "node:path";
import type { Arguments, Argv } from "yargs";
import { findGitRoot } from "@/features/config/config";
import { createAndInitProject } from "@/features/projects/create-and-init";

export const command = "create [name]";
export const describe = "Create a new project and initialize .pstdio in the current git root";

export const builder = (yargs: Argv) =>
  yargs.positional("name", {
    type: "string",
    describe: "The project name (defaults to current git root folder name)",
  });

const defaultDeps = {
  cwd: process.cwd,
  findGitRoot,
  createAndInitProject,
};

export const resolveProjectName = (root: string, name?: string) => {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : basename(root);
};

export const createHandler =
  (deps = defaultDeps) =>
  async (argv: Arguments<{ name?: string }>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) {
      throw new Error("Not inside a git repository. Run `git init` first.");
    }

    const project = await deps.createAndInitProject(root, resolveProjectName(root, argv.name));
    console.log(`Created project "${project.name}" (${project.id}) and initialized .pstdio at ${root}`);
  };

export const handler = createHandler();
