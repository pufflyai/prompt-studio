import { createClient, type PstdioClient } from "@pstdio/sdk/client";
import type {
  CommandDescriptor,
  CommandParamDef,
  CommandParamValue,
  CommandRunContext,
  CommandRunResult,
  CommandStorage,
  CommandTargetMap,
  CommandTargetType,
} from "@pstdio/sdk/plugins";
import type { PluginRuntime } from "pstdio-plugins/hooks";
import type { Argv } from "yargs";
import { createExtensionStorage } from "./storage";

type CommandArgv = {
  [key: string]: unknown;
  ticket?: string;
  workspace?: string;
};

type RunDeps = {
  createClient: () => PstdioClient;
  stdout: (message: string) => void;
};

const defaultDeps: RunDeps = {
  createClient: () => createClient(),
  stdout: console.log,
};

const findTarget = async <T extends CommandTargetType>(
  client: PstdioClient,
  projectId: string,
  targetType: T,
  argv: CommandArgv,
): Promise<CommandTargetMap[T]> => {
  if (targetType === "project") {
    return { id: projectId } as CommandTargetMap[T];
  }

  if (targetType === "ticket") {
    const ref = argv.ticket;
    if (!ref || typeof ref !== "string") {
      throw new Error('Missing required option "--ticket" for this command');
    }

    const tickets = await client.tickets.list(projectId);
    const ticket = tickets.find((value) => value.id === ref || value.shorthand === ref);
    if (!ticket) {
      throw new Error(`Ticket not found for ref: ${ref}`);
    }

    return ticket as CommandTargetMap[T];
  }

  const ref = argv.workspace;
  if (!ref || typeof ref !== "string") {
    throw new Error('Missing required option "--workspace" for this command');
  }

  const workspaces = await client.workspaces.list(projectId);
  const workspace = workspaces.find((value) => value.id === ref || value.workspace_shorthand === ref);
  if (!workspace) {
    throw new Error(`Workspace not found for ref: ${ref}`);
  }

  return workspace as CommandTargetMap[T];
};

const readParamValue = (argv: CommandArgv, param: CommandParamDef): CommandParamValue | undefined => {
  const value = argv[param.key];

  if (value === undefined) return undefined;
  if (param.type === "boolean") return Boolean(value);
  if (param.type === "number") return typeof value === "number" ? value : Number(value);
  return String(value);
};

const mapParams = (argv: CommandArgv, params: CommandParamDef[] | undefined) => {
  const mapped: Record<string, CommandParamValue> = {};

  for (const param of params ?? []) {
    const parsed = readParamValue(argv, param);
    if (parsed === undefined) continue;
    mapped[param.key] = parsed;
  }

  return mapped;
};

const toExtensionAndCommand = (namespacedKey: string) => {
  const lastSlash = namespacedKey.lastIndexOf("/");
  if (lastSlash <= 0) {
    return { extensionId: namespacedKey, commandId: namespacedKey };
  }

  return {
    extensionId: namespacedKey.slice(0, lastSlash),
    commandId: namespacedKey.slice(lastSlash + 1),
  };
};

const toWrappedCommandError = (namespacedKey: string, error: unknown) => {
  const { extensionId, commandId } = toExtensionAndCommand(namespacedKey);
  const message = error instanceof Error ? error.message : String(error);
  const prefix = `Extension command failed (${extensionId}/${commandId}): `;

  if (message.startsWith(prefix)) {
    return new Error(message);
  }

  return new Error(`${prefix}${message}`);
};

const assertNotRecursive = (stack: string[], commandKey: string) => {
  if (stack.includes(commandKey)) {
    throw new Error(`Recursive extension command execution is not allowed: ${[...stack, commandKey].join(" -> ")}`);
  }
};

type ExecuteInput = {
  runtime: PluginRuntime;
  commandKey: string;
  command: {
    descriptor: CommandDescriptor;
    run: (ctx: CommandRunContext) => Promise<CommandRunResult | undefined> | CommandRunResult | undefined;
  };
  projectId: string;
  target: CommandTargetMap[CommandTargetType];
  params: Record<string, CommandParamValue>;
  storage: CommandStorage;
  client: PstdioClient;
  stack: string[];
};

const executeCommand = async (input: ExecuteInput): Promise<CommandRunResult | undefined> => {
  const { runtime, commandKey, command, projectId, target, params, storage, client, stack } = input;
  const { extensionId, commandId } = toExtensionAndCommand(commandKey);

  assertNotRecursive(stack, commandKey);
  const nextStack = [...stack, commandKey];

  try {
    return await command.run({
      client,
      projectId,
      targetType: command.descriptor.targetType,
      target: target as never,
      params,
      storage,
      sessions: {
        create: (sessionInput) => client.sessions.create(sessionInput),
      },
      commands: {
        run: async (nextCommandKey, nestedInput) => {
          const resolved = runtime.commands.get(
            nextCommandKey.includes("/") ? nextCommandKey : `${extensionId}/${nextCommandKey}`,
          );

          if (!resolved) {
            throw new Error(`Command not found: ${nextCommandKey}`);
          }

          const nestedTarget = (nestedInput?.target ?? target) as CommandTargetMap[CommandTargetType];
          const nestedParams = nestedInput?.params ?? {};

          return executeCommand({
            runtime,
            commandKey: resolved.namespacedKey,
            command: {
              descriptor: resolved.descriptor,
              run: resolved.run as ExecuteInput["command"]["run"],
            },
            projectId,
            target: nestedTarget,
            params: nestedParams,
            storage,
            client,
            stack: nextStack,
          });
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Extension command failed (${extensionId}/${commandId}): ${message}`);
  }
};

const paramOption = (param: CommandParamDef) => {
  if (param.type === "boolean") {
    return {
      type: "boolean" as const,
      describe: param.description,
      demandOption: param.required,
      default: param.defaultValue,
    };
  }

  if (param.type === "number") {
    return {
      type: "number" as const,
      describe: param.description,
      demandOption: param.required,
      default: param.defaultValue,
    };
  }

  if (param.type === "select") {
    return {
      type: "string" as const,
      describe: param.description,
      demandOption: param.required,
      choices: param.options.map((option) => option.value),
      default: param.defaultValue,
    };
  }

  return {
    type: "string" as const,
    describe: param.description,
    demandOption: param.required,
    default: param.defaultValue,
  };
};

const addTargetOptions = (builder: Argv, targetType: CommandTargetType) => {
  if (targetType === "ticket") {
    return builder.option("ticket", {
      type: "string",
      describe: "Ticket ID or shorthand",
      demandOption: true,
    });
  }

  if (targetType === "workspace") {
    return builder.option("workspace", {
      type: "string",
      describe: "Workspace ID or shorthand",
      demandOption: true,
    });
  }

  return builder;
};

export const createExtensionCommandModule = (
  runtime: PluginRuntime,
  projectId: string,
  namespacedKey: string,
  deps: RunDeps = defaultDeps,
) => {
  const resolved = runtime.commands.get(namespacedKey);
  if (!resolved) {
    throw new Error(`Command not found: ${namespacedKey}`);
  }

  return {
    command: resolved.descriptor.path,
    describe: resolved.descriptor.description,
    builder: (yargs: Argv) => {
      let builder = addTargetOptions(yargs, resolved.descriptor.targetType);

      for (const param of resolved.descriptor.params ?? []) {
        builder = builder.option(param.key, paramOption(param));
      }

      return builder;
    },
    handler: async (argv: CommandArgv) => {
      const client = deps.createClient();
      const storage = createExtensionStorage(runtime.repoPath, toExtensionAndCommand(namespacedKey).extensionId);
      try {
        const target = await findTarget(client, projectId, resolved.descriptor.targetType, argv);
        const params = mapParams(argv, resolved.descriptor.params);
        const result = await executeCommand({
          runtime,
          commandKey: namespacedKey,
          command: {
            descriptor: resolved.descriptor,
            run: resolved.run as ExecuteInput["command"]["run"],
          },
          projectId,
          target,
          params,
          storage,
          client,
          stack: [],
        });

        if (result?.message) {
          deps.stdout(result.message);
        }
      } catch (error) {
        throw toWrappedCommandError(namespacedKey, error);
      }
    },
  };
};
