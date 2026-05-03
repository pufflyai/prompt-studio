import type { CommandOutcome } from "@pstdio/sdk/extensions";
import type {
  createExtensionCollectionItemsDBService,
  createExtensionKvDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionTemplatePreferencesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectExtensionInstancesDBService,
} from "pstdio-db";
import {
  type CheckExtensionsInput,
  type CheckExtensionsResult,
  type CommandExecuteInput,
  checkExtensions,
  createCommandRunner,
} from "pstdio-extensions";
import { buildExtensionEnvironment } from "../features/extensions/build-environment";

export type ExtensionServiceDeps = {
  installedExtensionSourcesDBService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  projectExtensionInstancesDBService: ReturnType<typeof createProjectExtensionInstancesDBService>;
  extensionKvDBService: ReturnType<typeof createExtensionKvDBService>;
  extensionCollectionItemsDBService: ReturnType<typeof createExtensionCollectionItemsDBService>;
  extensionTemplatePreferencesDBService: ReturnType<typeof createExtensionTemplatePreferencesDBService>;
  extensionSkillPreferencesDBService: ReturnType<typeof createExtensionSkillPreferencesDBService>;
  /** Override how the runtime check is invoked. Defaults to the real runtime. */
  runCheck?: (input?: CheckExtensionsInput) => Promise<CheckExtensionsResult>;
};

export const createExtensionService = (deps: ExtensionServiceDeps) => {
  const runCheck = deps.runCheck ?? checkExtensions;

  const buildEnv = buildExtensionEnvironment(deps.extensionKvDBService);

  const execute = async (
    input: CommandExecuteInput,
  ): Promise<{ extensionId: string; commandId: string; outcome: CommandOutcome }> => {
    const result = await runCheck();
    const command = result.runtime.commands.find((cmd) => cmd.id === input.commandId);
    if (!command) {
      return {
        commandId: input.commandId,
        extensionId: "",
        outcome: {
          ok: false,
          status: "error",
          code: "command_not_found",
          reason: `Command "${input.commandId}" is not registered`,
        },
      };
    }

    const runner = createCommandRunner(result.runtime, { buildEnvironment: buildEnv });
    const outcome = await runner.execute(input);
    return { commandId: input.commandId, extensionId: command.extensionId, outcome };
  };

  return {
    check: (input: CheckExtensionsInput = {}) => runCheck(input),
    execute,
    installedSources: deps.installedExtensionSourcesDBService,
    projectInstances: deps.projectExtensionInstancesDBService,
    kv: deps.extensionKvDBService,
    collections: deps.extensionCollectionItemsDBService,
    templatePreferences: deps.extensionTemplatePreferencesDBService,
    skillPreferences: deps.extensionSkillPreferencesDBService,
  };
};

export type ExtensionService = ReturnType<typeof createExtensionService>;
