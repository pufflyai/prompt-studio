import type { Arguments, Argv } from "yargs";
import { resolveHarnessId } from "@/features/agents/api/resolve-harness-id";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { getProjectFolder } from "@/features/projects/project-folder";
import { installSkillsForAgent } from "@/features/skills/install-default-skills";

export const command = "setup <agent-id>";
export const describe = "Configure an agent and install skills";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: "Agent to configure (bare or namespaced harness id; see `pstdio agents list`)",
    })
    .option("global-skills", {
      type: "boolean",
      default: false,
      describe: "Install skills to the agent's global config directory instead of the project",
    });

type SetupArgs = {
  "agent-id": string;
  "global-skills": boolean;
};

type Deps = {
  cwd: () => string;
  getProjectFolder: typeof getProjectFolder;
  resolveHarnessId: typeof resolveHarnessId;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  installSkillsForAgent: typeof installSkillsForAgent;
  log: (message: string) => void;
};

export const createHandler = (deps: Deps) => {
  return async (argv: Arguments<SetupArgs>) => {
    const agentId = argv["agent-id"];

    const harnessId = await deps.resolveHarnessId(agentId);
    deps.log(`Using harness "${harnessId}".`);

    const root = deps.findProjectRoot(deps.cwd());
    const installRoot = root ?? deps.cwd();
    const shouldInstallGlobalSkills = argv["global-skills"];

    if (!root && !shouldInstallGlobalSkills) {
      deps.log("Not inside a project folder — skipping skill installation.");
      return;
    }

    const projectConfig = deps.readConfig(installRoot);

    if (!projectConfig && !shouldInstallGlobalSkills) {
      deps.log("No project configured — skipping skill installation.");
    }

    let installedSkills: string[] = [];
    const shouldInstallSkills = Boolean(projectConfig || shouldInstallGlobalSkills);
    if (shouldInstallSkills) {
      installedSkills = await deps.installSkillsForAgent({
        root:
          projectConfig && !shouldInstallGlobalSkills
            ? await deps.getProjectFolder(projectConfig.project_id)
            : installRoot,
        agentId,
        projectId: projectConfig?.project_id,
        global: shouldInstallGlobalSkills,
      });
      if (installedSkills.length > 0) {
        deps.log(`Installed ${installedSkills.length} skill(s): ${installedSkills.join(", ")}`);
      } else {
        deps.log("All skills already installed.");
      }
    }
  };
};

export const handler = createHandler({
  cwd: () => process.cwd(),
  resolveHarnessId,
  getProjectFolder,
  findProjectRoot,
  readConfig,
  installSkillsForAgent,
  log: console.log,
});
