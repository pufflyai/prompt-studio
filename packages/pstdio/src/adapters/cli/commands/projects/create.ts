import { resolve } from "node:path";
import type { Arguments, Argv } from "yargs";
import { createAndInitProject } from "@/features/projects/create-and-init";

export const command = "create [name]";
export const describe = "Open one folder as a project";
export const builder = (yargs: Argv) =>
  yargs
    .positional("name", { type: "string", describe: "Project name (defaults to folder name)" })
    .option("path", { type: "string", describe: "Project folder (defaults to the exact current directory)" });
const defaultDeps = { cwd: process.cwd, createAndInitProject };
export const createHandler =
  (deps = defaultDeps) =>
  async (argv: Arguments<{ name?: string; path?: string }>) => {
    const path = resolve(deps.cwd(), argv.path ?? ".");
    const project = await deps.createAndInitProject(path, argv.name);
    console.log(`Opened project "${project.name}" (${project.id}) at ${path}`);
    for (const warning of project.extension_warnings ?? [])
      console.warn(`Extension setup warning for ${warning.extension}: ${warning.message}`);
  };
export const handler = createHandler();
