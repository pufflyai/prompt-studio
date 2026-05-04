import { isKnownAgentId, KNOWN_AGENT_IDS } from "pstdio-api-contracts/known-agents";
import type { Arguments, Argv } from "yargs";
import { doesAgentRequirePlugins, installPluginsForAgent } from "@/features/agents/install-agent-plugins";
import { findGitRoot } from "@/features/config/config";

export const command = "install-plugins <agent-id>";
export const describe = "Install plugins for an agent";

export const builder = (yargs: Argv) =>
  yargs
    .positional("agent-id", {
      type: "string",
      demandOption: true,
      describe: `Agent to install plugins for (${KNOWN_AGENT_IDS.join(", ")})`,
    })
    .option("global-plugins", {
      type: "boolean",
      default: false,
      describe: "Install plugins to the agent's global config directory",
    });

type InstallPluginsArgs = {
  "agent-id": string;
  "global-plugins": boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  installPluginsForAgent: typeof installPluginsForAgent;
  log: (message: string) => void;
};

export const createHandler = (deps: Deps) => {
  return async (argv: Arguments<InstallPluginsArgs>) => {
    const agentId = argv["agent-id"];

    if (!isKnownAgentId(agentId)) {
      throw new Error(`Unknown agent: ${agentId}. Available: ${KNOWN_AGENT_IDS.join(", ")}`);
    }

    if (!doesAgentRequirePlugins(agentId)) {
      deps.log(`No plugin artifacts are required for agent "${agentId}".`);
      return;
    }

    const root = deps.findGitRoot(deps.cwd());
    if (!root && !argv["global-plugins"]) {
      throw new Error("Not inside a git repository. Use --global-plugins or run from a git repo.");
    }

    const installed = await deps.installPluginsForAgent({
      root: root ?? deps.cwd(),
      agentId,
      global: argv["global-plugins"],
    });

    if (installed.length > 0) {
      deps.log(`Installed ${installed.length} plugin artifact(s): ${installed.join(", ")}`);
      return;
    }

    deps.log("All plugin artifacts already installed.");
  };
};

export const handler = createHandler({
  cwd: () => process.cwd(),
  findGitRoot,
  installPluginsForAgent,
  log: console.log,
});
