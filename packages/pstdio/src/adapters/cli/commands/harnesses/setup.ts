import type { Arguments, Argv } from "yargs";
import { doesAgentRequirePlugins, installPluginsForAgent } from "@/features/agents/install-agent-plugins";
import { findGitRoot, readConfig } from "@/features/config/config";
import { setupHarness } from "@/features/harnesses/api/setup-harness";
import { toAgentId } from "@/features/harnesses/harness-id";
import { installSkillsForAgent } from "@/features/skills/install-default-skills";

export const command = "setup <harness-id>";
export const describe = "Configure a harness provider and install skills/plugins";

export const builder = (yargs: Argv) =>
  yargs
    .positional("harness-id", {
      type: "string",
      demandOption: true,
      describe: "Harness provider id (for example pstdio.harness.claude-code)",
    })
    .option("binary", { type: "string", describe: "Override harness executable path" })
    .option("global-skills", {
      type: "boolean",
      default: false,
      describe: "Install skills to the provider's global config directory instead of the project",
    })
    .option("global-plugins", {
      type: "boolean",
      default: false,
      describe: "Install plugins to the provider's global config directory instead of the project",
    });

type SetupArgs = {
  "harness-id": string;
  binary?: string;
  "global-skills": boolean;
  "global-plugins": boolean;
};

type Deps = {
  cwd: () => string;
  setupHarness: typeof setupHarness;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  installSkillsForAgent: typeof installSkillsForAgent;
  installPluginsForAgent: typeof installPluginsForAgent;
  log: (message: string) => void;
};

export const createHandler = (deps: Deps) => {
  return async (argv: Arguments<SetupArgs>) => {
    const config = await deps.setupHarness(argv["harness-id"], argv.binary);
    deps.log(`Harness "${config.harness_id}" configured${config.is_default ? " (default)" : ""}.`);

    const agentId = toAgentId(config.harness_id);
    const root = deps.findGitRoot(deps.cwd());
    const installRoot = root ?? deps.cwd();
    const shouldInstallGlobalSkills = argv["global-skills"];
    const shouldInstallGlobalPlugins = argv["global-plugins"];

    if (!root && !shouldInstallGlobalSkills && !shouldInstallGlobalPlugins) {
      deps.log("Not inside a git repository - skipping skill/plugin installation.");
      return;
    }

    const projectConfig = deps.readConfig(installRoot);

    if (!projectConfig && !shouldInstallGlobalSkills) {
      deps.log("No project configured - skipping skill installation.");
    }

    const shouldInstallSkills = Boolean(projectConfig || shouldInstallGlobalSkills);
    if (shouldInstallSkills) {
      const installedSkills = await deps.installSkillsForAgent({
        root: installRoot,
        agentId,
        projectId: projectConfig?.project_id,
        global: shouldInstallGlobalSkills,
      });
      deps.log(
        installedSkills.length > 0
          ? `Installed ${installedSkills.length} skill(s): ${installedSkills.join(", ")}`
          : "All skills already installed.",
      );
    }

    if (!doesAgentRequirePlugins(agentId)) {
      return;
    }

    const installedPlugins = await deps.installPluginsForAgent({
      root: installRoot,
      agentId,
      global: shouldInstallGlobalPlugins,
    });

    deps.log(
      installedPlugins.length > 0
        ? `Installed ${installedPlugins.length} plugin artifact(s): ${installedPlugins.join(", ")}`
        : "All plugin artifacts already installed.",
    );
  };
};

export const handler = async (argv: Arguments<SetupArgs>) => {
  await createHandler({
    cwd: () => process.cwd(),
    setupHarness,
    findGitRoot,
    readConfig,
    installSkillsForAgent,
    installPluginsForAgent,
    log: console.log,
  })(argv);
};
