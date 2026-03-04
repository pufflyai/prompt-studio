import { readFileSync } from "node:fs";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { getProject } from "@/features/projects/api/get-project";
import { setStartupScript } from "@/features/projects/api/set-startup-script";

export const command = "set";
export const describe = "Set the project startup script";

export const builder = (yargs: Argv) =>
  yargs.option("file", {
    type: "string",
    describe: "Path to a script file. If omitted, reads from stdin.",
  });

const defaultDeps = {
  cwd: process.cwd,
  findGitRoot,
  readConfig,
  getProject,
  setStartupScript,
  readFile: (path: string) => readFileSync(path, "utf8"),
  readStdin: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  },
};

export const createHandler =
  (deps = defaultDeps) =>
  async (argv: Arguments<{ file?: string }>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) {
      throw new Error("Not inside a git repository.");
    }

    const config = deps.readConfig(root);
    if (!config) {
      throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
    }

    let script: string;
    if (argv.file) {
      try {
        script = deps.readFile(argv.file);
      } catch {
        throw new Error(`File not found: ${argv.file}`);
      }
    } else {
      script = await deps.readStdin();
    }

    await deps.setStartupScript(API_URL, config.project_id, script);

    const project = await deps.getProject(API_URL, config.project_id);
    console.log(`Startup script set for project "${project?.name ?? config.project_id}".`);
  };

export const handler = createHandler();
