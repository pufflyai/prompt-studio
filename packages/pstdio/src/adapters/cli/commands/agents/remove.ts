import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-agents";
import type { Arguments, Argv } from "yargs";
import { removeAgent } from "@/features/agents/api/remove-agent";
import { API_URL } from "@/features/api-url";

export const command = "remove <agent-id>";
export const describe = "Remove a configured agent";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: `Agent to remove (${KNOWN_AGENT_IDS.join(", ")})`,
    })
    .option("delete-skills", {
      type: "boolean",
      default: false,
      describe: "Also delete the agent's skills directory from the repo",
    });

export const handler = async (argv: Arguments<{ "agent-id": string; "delete-skills": boolean }>) => {
  const agentId = argv["agent-id"];
  const deleteSkills = argv["delete-skills"];

  if (!isKnownAgentId(agentId)) {
    throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
  }

  await removeAgent(API_URL, agentId, { deleteSkills });
  console.log(`Agent "${agentId}" removed.`);
};
