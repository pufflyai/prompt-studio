import type { PstdioClient } from "../client/client";
import type { Session } from "../resources/session";
import type { TicketListItem } from "../resources/ticket";
import type { WorkspaceListItem } from "../resources/workspace";
import type { PluginHooks } from "./hooks";

export type TargetType = "ticket" | "workspace" | "session";
export type ActionPlacement = "primary" | "secondary" | "overflow";

export type ActionTargetMap = {
  ticket: TicketListItem;
  workspace: WorkspaceListItem;
  session: Session;
};

type ActionTriggerContextBase = {
  client: PstdioClient;
  projectId: string;
  prompts: Record<string, string>;
};

export type ActionTriggerContext<TTargetType extends TargetType = TargetType> = ActionTriggerContextBase &
  (TTargetType extends TargetType
    ? {
        targetType: TTargetType;
        targetId: string;
        target: ActionTargetMap[TTargetType];
      }
    : never);

export type ActionInput = {
  [K in TargetType]: {
    key: string;
    label: string;
    targetType: K;
    placement: ActionPlacement;
    trigger: (ctx: ActionTriggerContext<K>) => void | Promise<void>;
  };
}[TargetType];

export type ActionDescriptor = {
  key: string;
  label: string;
  targetType: TargetType;
  placement: ActionPlacement;
};

export type ActionDefinition = ActionDescriptor & {
  trigger: (ctx: ActionTriggerContext) => void | Promise<void>;
};

export type PluginDefinition = {
  key?: string;
  actions?: ActionInput[];
  hooks?: PluginHooks;
};
