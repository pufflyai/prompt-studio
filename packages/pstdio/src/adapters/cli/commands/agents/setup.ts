import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-agents";
import type { Arguments, Argv } from "yargs";
import { setupAgent } from "@/features/agents/api/setup-agent";
import { API_URL } from "@/features/api-url";
import { findGitRoot } from "@/features/config/config";
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

export const handler = async (argv: Arguments<{ "agent-id": string; "global-skills": boolean }>) => {
  const agentId = argv["agent-id"];

  if (!isKnownAgentId(agentId)) {
    throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
  }

  const config = await setupAgent(API_URL, agentId);
  console.log(`Agent "${config.agent_id}" configured${config.is_default ? " (default)" : ""}.`);

  const root = findGitRoot(process.cwd());
  if (!root && !argv["global-skills"]) {
    console.log("Not inside a git repository — skipping skill installation.");
    return;
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
