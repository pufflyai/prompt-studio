import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-api-contracts/known-agents";
import type { Arguments, Argv } from "yargs";
import { updateAgent as updateAgentApi } from "@/features/agents/api/update-agent";

export const command = "update <agent-id>";
export const describe = "Update an agent configuration";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: `Agent to update (${KNOWN_AGENT_IDS.join(", ")})`,
    })
    .option("default", {
      type: "boolean",
      describe: "Set as the default agent",
    })
    .option("binary", {
      type: "string",
      describe: "Override the agent binary path",
    })
    .option("skills-dir", {
      type: "string",
      describe: "Override the agent skills directory",
    });

type UpdateArgs = {
  "agent-id": string;
  default?: boolean;
  binary?: string;
  "skills-dir"?: string;
};

type Deps = {
  updateAgent: (
    agentId: string,
    fields: { is_default?: boolean; binary?: string; skills_dir?: string },
  ) => Promise<{
    agent_id: string;
    is_default: boolean;
  }>;
};

export const createHandler = (deps: Deps) => {
  return async (argv: Arguments<UpdateArgs>) => {
    const agentId = argv["agent-id"];

    if (!isKnownAgentId(agentId)) {
      throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
    }

    const config = await deps.updateAgent(agentId, {
      is_default: argv.default,
      binary: argv.binary,
      skills_dir: argv["skills-dir"],
    });

    const suffix = config.is_default ? " (default)" : "";
    console.log(`Agent "${config.agent_id}" updated${suffix}.`);
  };
};

export const handler = createHandler({
  updateAgent: (agentId, fields) => updateAgentApi(agentId, fields),
});
