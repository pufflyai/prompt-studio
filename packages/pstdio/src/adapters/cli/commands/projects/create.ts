import { basename } from "node:path";
import type { Arguments, Argv } from "yargs";
import { findGitRoot } from "@/features/config/config";
import { createAndInitProject } from "@/features/projects/create-and-init";

export const command = "create [name]";
export const describe = "Create a new project and initialize .pstdio in the current directory";

export const builder = (yargs: Argv) =>
  yargs
    .positional("name", {
      type: "string",
      describe: "The project name (defaults to current folder name)",
    })
    .option("repo", {
      type: "string",
      array: true,
      describe: "Path(s) to git repos to connect (repeatable). Defaults to current git repo if inside one.",
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

export const resolveRepoPaths = (
  explicitRepos: string[] | undefined,
  cwd: string,
  gitRootFinder: (dir: string) => string | null,
) => {
  if (explicitRepos !== undefined) return explicitRepos;
  const root = gitRootFinder(cwd);
  return root ? [root] : [];
};

export const validateRepoPaths = (repoPaths: string[], gitRootFinder: (dir: string) => string | null) => {
  for (const p of repoPaths) {
    if (!gitRootFinder(p)) {
      throw new Error(`Not a git repository: ${p}`);
    }
  }
};

export const createHandler =
  (deps = defaultDeps) =>
  async (argv: Arguments<{ name?: string; repo?: string[] }>) => {
    const cwd = deps.cwd();
    const root = deps.findGitRoot(cwd) ?? cwd;
    const repoPaths = resolveRepoPaths(argv.repo, cwd, deps.findGitRoot);
    validateRepoPaths(repoPaths, deps.findGitRoot);

    const name = resolveProjectName(root, argv.name);
    const project = await deps.createAndInitProject(root, name, { repoPaths });
    console.log(`Created project "${project.name}" (${project.id}) and initialized .pstdio at ${root}`);
  };

export const handler = createHandler();
