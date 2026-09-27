import type { Arguments, Argv } from "yargs";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { getProjectFolder } from "@/features/projects/project-folder";
import { installSkillsForAgent } from "@/features/skills/install-default-skills";

export const command = "install-skills <agent-id>";
export const describe = "Install skills for an agent";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: "Agent to install skills for (bare or namespaced harness id; see `pstdio agents list`)",
    })
    .option("global-skills", {
      type: "boolean",
      default: false,
      describe: "Install skills to the agent's global config directory",
    });

export const handler = async (argv: Arguments<{ "agent-id": string; "global-skills": boolean }>) => {
  const agentId = argv["agent-id"];

  const root = findProjectRoot(process.cwd());

  if (!root && !argv["global-skills"]) {
    throw new Error("Not inside a pstdio project. Use --global-skills or run from a project folder.");
  }

  const projectConfig = readConfig(root ?? process.cwd());
  if (!projectConfig && !argv["global-skills"]) {
    throw new Error("No project configured. Run `pstdio projects create` first.");
  }

  const installed = await installSkillsForAgent({
    root:
      projectConfig && !argv["global-skills"]
        ? await getProjectFolder(projectConfig.project_id)
        : (root ?? process.cwd()),
    agentId,
    projectId: projectConfig?.project_id,
    global: argv["global-skills"],
  });

  if (installed.length > 0) {
    console.log(`Installed ${installed.length} skill(s): ${installed.join(", ")}`);
  } else {
    console.log("All skills already installed.");
  }
};
