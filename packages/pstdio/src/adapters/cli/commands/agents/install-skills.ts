import type { Arguments, Argv } from "yargs";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { getProjectFolder } from "@/features/projects/project-folder";
import { describeSkillInstall, installSkillsForAgent } from "@/features/skills/install-skills";

export const command = "install-skills <agent-id>";
export const describe = "Install missing skills for an agent and keep existing skill folders";

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
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Replace each enabled skill's existing folder with the current version, discarding local edits",
    });

export const handler = async (argv: Arguments<{ "agent-id": string; "global-skills": boolean; force: boolean }>) => {
  const agentId = argv["agent-id"];

  const root = findProjectRoot(process.cwd());

  if (!root && !argv["global-skills"]) {
    throw new Error("Not inside a pstdio project. Use --global-skills or run from a project folder.");
  }

  const projectConfig = readConfig(root ?? process.cwd());
  if (!projectConfig && !argv["global-skills"]) {
    throw new Error("No project configured. Run `pstdio projects create` first.");
  }

  const result = await installSkillsForAgent({
    root:
      projectConfig && !argv["global-skills"]
        ? await getProjectFolder(projectConfig.project_id)
        : (root ?? process.cwd()),
    agentId,
    projectId: projectConfig?.project_id,
    global: argv["global-skills"],
    force: argv.force,
  });

  for (const line of describeSkillInstall(result, { agentId, global: argv["global-skills"] })) console.log(line);
};
