import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-agents";
import type { Arguments, Argv } from "yargs";
import { setupAgent } from "@/features/agents/api/setup-agent";
import { doesAgentRequirePlugins, installPluginsForAgent } from "@/features/agents/install-agent-plugins";
import { findGitRoot } from "@/features/config/config";

export const command = "setup <agent-id>";
export const describe = "Configure an agent and install plugin artifacts";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: `Agent to configure (${KNOWN_AGENT_IDS.join(", ")})`,
    })
    .option("global-plugins", {
      type: "boolean",
      default: false,
      describe: "Install plugins to the agent's global config directory instead of the project",
    });

type SetupArgs = {
  "agent-id": string;
  "global-plugins": boolean;
};

type Deps = {
  cwd: () => string;
  setupAgent: typeof setupAgent;
  findGitRoot: typeof findGitRoot;
  installPluginsForAgent: typeof installPluginsForAgent;
  log: (message: string) => void;
};

export const createHandler = (deps: Deps) => {
  return async (argv: Arguments<SetupArgs>) => {
    const agentId = argv["agent-id"];

    if (!isKnownAgentId(agentId)) {
      throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
    }

    const config = await deps.setupAgent(agentId);
    deps.log(`Agent "${config.agent_id}" configured${config.is_default ? " (default)" : ""}.`);

    const root = deps.findGitRoot(deps.cwd());
    const installRoot = root ?? deps.cwd();
    const shouldInstallGlobalPlugins = argv["global-plugins"];

    if (!root && !shouldInstallGlobalPlugins) {
      deps.log("Not inside a git repository — skipping plugin installation.");
      return;
    }

    if (!doesAgentRequirePlugins(agentId)) {
      return;
    }

    const installedPlugins = await deps.installPluginsForAgent({
      root: installRoot,
      agentId,
      global: shouldInstallGlobalPlugins,
    });

    if (installedPlugins.length > 0) {
      deps.log(`Installed ${installedPlugins.length} plugin artifact(s): ${installedPlugins.join(", ")}`);
      return;
    }

    deps.log("All plugin artifacts already installed.");
  };
};

export const handler = createHandler({
  cwd: () => process.cwd(),
  setupAgent,
  findGitRoot,
  installPluginsForAgent,
  log: console.log,
});
