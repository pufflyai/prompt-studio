import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-agents";
import type { Arguments, Argv } from "yargs";
import { removeAgent } from "@/features/agents/api/remove-agent";

export const command = "remove <agent-id>";
export const describe = "Remove a configured agent";

export const builder = (yargs: Argv) =>
  yargs.positional("agent-id", {
    type: "string",
    demandOption: true,
    describe: `Agent to remove (${KNOWN_AGENT_IDS.join(", ")})`,
  });

export const handler = async (argv: Arguments<{ "agent-id": string }>) => {
  const agentId = argv["agent-id"];

  if (!isKnownAgentId(agentId)) {
    throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
  }

  await removeAgent(agentId);
  console.log(`Agent "${agentId}" removed.`);
};
