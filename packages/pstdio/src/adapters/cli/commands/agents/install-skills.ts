import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-agents";
import type { Arguments, Argv } from "yargs";
import { findGitRoot } from "@/features/config/config";
import { installSkillsForAgent } from "@/features/skills/install-default-skills";

export const command = "install-skills <agent-id>";
export const describe = "Install bundled skills for an agent";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: `Agent to install skills for (${KNOWN_AGENT_IDS.join(", ")})`,
    })
    .option("global-skills", {
      type: "boolean",
      default: false,
      describe: "Install skills to the agent's global config directory",
    });

export const handler = async (argv: Arguments<{ "agent-id": string; "global-skills": boolean }>) => {
  const agentId = argv["agent-id"];

  if (!isKnownAgentId(agentId)) {
    throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
  }

  const root = findGitRoot(process.cwd());

  if (!root && !argv["global-skills"]) {
    throw new Error("Not inside a git repository. Use --global-skills or run from a git repo.");
  }

  const installed = installSkillsForAgent({
    root: root ?? process.cwd(),
    agentId,
    global: argv["global-skills"],
  });

  if (installed.length > 0) {
    console.log(`Installed ${installed.length} skill(s): ${installed.join(", ")}`);
  } else {
    console.log("All skills already installed.");
  }
};
