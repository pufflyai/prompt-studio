import type { LucideIcon } from "lucide-react";
import type { ActionDescriptor } from "../api";

type HeaderActionKind = "plugin" | "default";

export interface HeaderActionItem {
  key: string;
  label: string;
  kind: HeaderActionKind;
  onClick: () => void;
  isDisabled?: boolean;
  icon?: LucideIcon;
}

interface BuildHeaderActionGroupsInput {
  pluginActions: ActionDescriptor[] | undefined;
  defaultOverflowActions?: HeaderActionItem[];
  onPluginAction: (actionKey: string) => void;
}

export const buildHeaderActionGroups = (input: BuildHeaderActionGroupsInput) => {
  const { pluginActions, defaultOverflowActions = [], onPluginAction } = input;

  const primary: HeaderActionItem[] = [];
  const secondary: HeaderActionItem[] = [];
  const overflow: HeaderActionItem[] = [];

  for (const action of pluginActions ?? []) {
    const item: HeaderActionItem = {
      key: action.key,
      label: action.label,
      kind: "plugin",
      onClick: () => onPluginAction(action.key),
    };

    if (action.placement === "primary") {
      primary.push(item);
      continue;
    }

    if (action.placement === "secondary") {
      secondary.push(item);
      continue;
    }

    overflow.push(item);
  }

  overflow.push(...defaultOverflowActions);

  return { primary, secondary, overflow };
};
