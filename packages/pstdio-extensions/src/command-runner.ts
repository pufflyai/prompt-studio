import type {
  ActivityRecordInput,
  ExtensionActivityApi,
  ExtensionSessionsApi,
  ParamValue,
  ResourceRef,
  RuntimeCommandRecord,
} from "@pstdio/sdk/extensions";
import { createActivityEventsDBService, createSessionsDBService, type DbClient } from "pstdio-db";
import { createExtensionStorageContext } from "./storage-context";

type RunExtensionCommandInput = {
  commands: RuntimeCommandRecord[];
  db: DbClient;
  projectId: string;
  commandId: string;
  params?: Record<string, unknown>;
  target?: ResourceRef;
  sessions?: ExtensionSessionsApi;
  activity?: ExtensionActivityApi;
  commandStack?: string[];
};

type CreateSessionInput = Parameters<ExtensionSessionsApi["create"]>[0];

const toParamValue = (value: unknown): ParamValue => value as ParamValue;

const normalizeParams = (params: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, toParamValue(value)]));

const createDefaultTarget = (command: RuntimeCommandRecord, projectId: string): ResourceRef => {
  const targetType = command.target ?? "project";

  if (targetType !== "project") {
    throw new Error(
      `Extension command "${command.id}" targets "${targetType}" and requires an explicit ${targetType} target.`,
    );
  }

  return {
    type: "project",
    id: projectId,
    projectId,
  };
};

const requiresSessionAdapter = (input: CreateSessionInput) =>
  input.prompt !== undefined || Boolean(input.anchors?.length) || input.metadata !== undefined;

const createDefaultSessionsApi = (db: DbClient, projectId: string): ExtensionSessionsApi => {
  const sessions = createSessionsDBService(db);

  return {
    create: (sessionInput) => {
      if (requiresSessionAdapter(sessionInput)) {
        throw new Error("Extension session creation with prompt, anchors, or metadata requires a session adapter.");
      }

      return sessions.create({
        project_id: projectId,
        title: sessionInput.title,
        agent: "extension-command",
      });
    },
  };
};

const createCommandSessionsApi = (input: RunExtensionCommandInput): ExtensionSessionsApi => {
  const defaultSessions = createDefaultSessionsApi(input.db, input.projectId);

  return {
    create: (sessionInput) => {
      if (input.sessions && requiresSessionAdapter(sessionInput)) {
        return input.sessions.create(sessionInput);
      }

      return defaultSessions.create(sessionInput);
    },
  };
};

const createDefaultActivityApi = (
  db: DbClient,
  projectId: string,
  extensionId: string,
  target: ResourceRef,
): ExtensionActivityApi => {
  const activityEvents = createActivityEventsDBService(db);

  return {
    record: (activityInput: ActivityRecordInput) =>
      activityEvents.create({
        projectId,
        target: activityInput.target ?? target,
        related: activityInput.related,
        sourceExtensionId: extensionId,
        eventType: activityInput.eventType,
        actorType: "system",
        source: "hook",
        summary: activityInput.summary,
        payloadJson: activityInput.metadata ?? {},
      }),
  };
};

const createCommandActivityApi = (
  input: RunExtensionCommandInput,
  command: RuntimeCommandRecord,
  target: ResourceRef,
): ExtensionActivityApi => {
  const defaultActivity = createDefaultActivityApi(input.db, input.projectId, command.extensionId, target);

  return {
    record: (activityInput) => {
      if (!input.activity) return defaultActivity.record(activityInput);

      return input.activity.record({
        ...activityInput,
        target: activityInput.target ?? target,
      });
    },
  };
};

const formatErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const runExtensionCommand = async (input: RunExtensionCommandInput): Promise<unknown> => {
  const command = input.commands.find((candidate) => candidate.id === input.commandId);
  if (!command) {
    throw new Error(`Extension command "${input.commandId}" was not found.`);
  }

  const commandStack = input.commandStack ?? [];
  if (commandStack.includes(command.id)) {
    throw new Error(`Recursive extension command execution blocked for "${command.id}".`);
  }

  const nextCommandStack = [...commandStack, command.id];
  const target = input.target ?? createDefaultTarget(command, input.projectId);
  const sessions = createCommandSessionsApi(input);
  const activity = createCommandActivityApi(input, command, target);

  try {
    return await command.run({
      projectId: input.projectId,
      target,
      params: normalizeParams(input.params),
      storage: createExtensionStorageContext({
        db: input.db,
        projectId: input.projectId,
        extensionId: command.extensionId,
      }),
      sessions: {
        create: (sessionInput) => sessions.create(sessionInput),
      },
      activity,
      commands: {
        run: (commandId, params) =>
          runExtensionCommand({
            ...input,
            commandId,
            params,
            target,
            commandStack: nextCommandStack,
          }),
      },
    });
  } catch (error) {
    throw new Error(
      `Extension command "${command.id}" from "${command.extensionId}" failed: ${formatErrorMessage(error)}`,
    );
  }
};
