import type { PstdioClient } from "../client/client";
import type { Session } from "../resources/session";
import type { TicketListItem } from "../resources/ticket";
import type { WorkspaceListItem } from "../resources/workspace";
import type { PluginHooks } from "./hooks";

export type TargetType = "ticket" | "workspace" | "session";
export type ActionPlacement = "primary" | "secondary" | "overflow";

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

export type ActionTriggerResult = { session_id?: string };

export type ActionInput = {
  [K in TargetType]: {
    key: string;
    label: string;
    targetType: K;
    placement: ActionPlacement;
    params?: ActionParamDef[];
    trigger: (ctx: ActionTriggerContext<K>) => void | ActionTriggerResult | Promise<void | ActionTriggerResult>;
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
  trigger: (ctx: ActionTriggerContext) => void | ActionTriggerResult | Promise<void | ActionTriggerResult>;
};

export type PluginDefinition = {
  key?: string;
  actions?: ActionInput[];
  hooks?: PluginHooks;
};
