import { isKnownAgentId, KNOWN_AGENT_IDS } from "@pstdio/sdk/resources";
import type { Arguments, Argv } from "yargs";
import { resolveHarnessId } from "@/features/agents/api/resolve-harness-id";
import { findGitRoot, readConfig } from "@/features/config/config";
import { installSkillsForAgent } from "@/features/skills/install-default-skills";

export const command = "setup <agent-id>";
export const describe = "Configure an agent and install skills";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: `Agent to configure (${KNOWN_AGENT_IDS.join(", ")})`,
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
  resolveHarnessId: typeof resolveHarnessId;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  installSkillsForAgent: typeof installSkillsForAgent;
  log: (message: string) => void;
};

export const createHandler = (deps: Deps) => {
  return async (argv: Arguments<SetupArgs>) => {
    const agentId = argv["agent-id"];

    if (!isKnownAgentId(agentId)) {
      throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
    }

    const harnessId = await deps.resolveHarnessId(agentId);
    deps.log(`Using harness "${harnessId}".`);

    const root = deps.findGitRoot(deps.cwd());
    const installRoot = root ?? deps.cwd();
    const shouldInstallGlobalSkills = argv["global-skills"];

    if (!root && !shouldInstallGlobalSkills) {
      deps.log("Not inside a git repository — skipping skill installation.");
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
        root: installRoot,
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
  findGitRoot,
  readConfig,
  installSkillsForAgent,
  log: console.log,
});
