import type { CreateSessionInput } from "pstdio-api-contracts";
import type { PstdioClient } from "../client/client";
import type { Session } from "../resources/session";
import type { TicketListItem } from "../resources/ticket";
import type { WorkspaceListItem } from "../resources/workspace";
import type { PluginHooks } from "./hooks";

export type TargetType = "ticket" | "workspace" | "session";
export type ActionPlacement = "primary" | "secondary" | "overflow";
export type CommandTargetType = "project" | "ticket" | "workspace";

// -- Action param definitions ------------------------------------------------

type ActionParamBase = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
};

export type TextActionParam = ActionParamBase & { type: "text" };
export type LongTextActionParam = ActionParamBase & { type: "longtext" };
export type SelectActionParam = ActionParamBase & {
  type: "select";
  options: { value: string; label: string }[];
};
export type TemplateSelectActionParam = ActionParamBase & {
  type: "template-select";
  templateType: string;
};
export type AgentActionParam = ActionParamBase & { type: "agent" };
export type RepoActionParam = ActionParamBase & { type: "repo" };

export type ActionParamDef =
  | TextActionParam
  | LongTextActionParam
  | SelectActionParam
  | TemplateSelectActionParam
  | AgentActionParam
  | RepoActionParam;

export type AgentParamValue = { agent: string; model: string };
export type RepoParamValue = { repo: string; branch: string };
export type ActionParamValue = string | AgentParamValue | RepoParamValue;

export type ActionTargetMap = {
  ticket: TicketListItem;
  workspace: WorkspaceListItem;
  session: Session;
};

type ActionTriggerContextBase = {
  client: PstdioClient;
  projectId: string;
  prompts: Record<string, string>;
  params: Record<string, ActionParamValue>;
};

export type ActionTriggerContext<TTargetType extends TargetType = TargetType> = ActionTriggerContextBase &
  (TTargetType extends TargetType
    ? {
        targetType: TTargetType;
        targetId: string;
        target: ActionTargetMap[TTargetType];
      }
    : never);

export type ActionTriggerResult = { session_id?: string; message?: string };
type ActionTrigger<TTargetType extends TargetType = TargetType> =
  | ((ctx: ActionTriggerContext<TTargetType>) => void)
  | ((ctx: ActionTriggerContext<TTargetType>) => ActionTriggerResult)
  | ((ctx: ActionTriggerContext<TTargetType>) => Promise<ActionTriggerResult | undefined>);

export type ActionInput = {
  [K in TargetType]: {
    key: string;
    label: string;
    targetType: K;
    placement: ActionPlacement;
    params?: ActionParamDef[];
    trigger: ActionTrigger<K>;
  };
}[TargetType];

export type ActionDescriptor = {
  key: string;
  label: string;
  targetType: TargetType;
  placement: ActionPlacement;
  params?: ActionParamDef[];
};

export type ActionDefinition = ActionDescriptor & {
  trigger: ActionTrigger;
};

// -- Command definitions ------------------------------------------------------

type CommandParamBase = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
};

export type TextCommandParam = CommandParamBase & {
  type: "text";
  defaultValue?: string;
};

export type BooleanCommandParam = CommandParamBase & {
  type: "boolean";
  defaultValue?: boolean;
};

export type NumberCommandParam = CommandParamBase & {
  type: "number";
  defaultValue?: number;
};

export type SelectCommandParam = CommandParamBase & {
  type: "select";
  options: { value: string; label: string }[];
  defaultValue?: string;
};

export type CommandParamDef = TextCommandParam | BooleanCommandParam | NumberCommandParam | SelectCommandParam;

export type CommandParamValue = string | boolean | number;

export type CommandTargetMap = {
  project: { id: string };
  ticket: TicketListItem;
  workspace: WorkspaceListItem;
};

export type CommandStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
};

export type CommandRunResult = {
  message?: string;
};

export type CommandRunContext<TTargetType extends CommandTargetType = CommandTargetType> = {
  client: PstdioClient;
  projectId: string;
  targetType: TTargetType;
  target: CommandTargetMap[TTargetType];
  params: Record<string, CommandParamValue>;
  storage: CommandStorage;
  sessions: {
    create(input: CreateSessionInput): Promise<Session>;
  };
  commands: {
    run(
      commandKey: string,
      input?: {
        params?: Record<string, CommandParamValue>;
        target?: CommandTargetMap[TTargetType];
      },
    ): Promise<CommandRunResult | undefined>;
  };
};

type CommandHandler<TTargetType extends CommandTargetType = CommandTargetType> =
  | ((ctx: CommandRunContext<TTargetType>) => undefined)
  | ((ctx: CommandRunContext<TTargetType>) => CommandRunResult)
  | ((ctx: CommandRunContext<TTargetType>) => Promise<CommandRunResult | undefined>);

export type CommandInput = {
  [K in CommandTargetType]: {
    key: string;
    path: string;
    description: string;
    targetType: K;
    params?: CommandParamDef[];
    run: CommandHandler<K>;
  };
}[CommandTargetType];

export type CommandDescriptor = {
  key: string;
  path: string;
  description: string;
  targetType: CommandTargetType;
  params?: CommandParamDef[];
};

export type CommandDefinition = CommandDescriptor & {
  run: CommandHandler;
};

export type ScheduledTriggerContext = {
  client: PstdioClient;
  projectId: string;
  trigger: { type: "schedule" };
  scheduleName: string;
  scheduledFor: string;
  runId: string;
};

type ScheduleHandler = (ctx: ScheduledTriggerContext) => void | Promise<void>;

export type ScheduleDefinition = {
  name: string;
  cron: string;
  timeoutMs?: number;
  handler: ScheduleHandler;
};

export type PluginDefinition = {
  key?: string;
  actions?: ActionInput[];
  commands?: CommandInput[];
  hooks?: PluginHooks;
  schedules?: ScheduleDefinition[];
};
