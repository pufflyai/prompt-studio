import type {
  CommandExecuteResponse,
  ExtensionMenuContribution,
  ExtensionNavigationRecord,
  ExtensionViewRecord,
} from "pstdio-api-contracts";
import type { HeaderActionItem } from "@/features/actions/header-actions";

type SlotKind = "menu" | "navigation" | "view" | "settings" | "renderer";
export type ExtensionMenuPresentation = "button-group" | "overflow-menu";

export interface CommandOutcomeToast {
  type: "info" | "success" | "warning" | "error";
  title: string;
  description: string;
}

export type ExtensionMenuActionItem = HeaderActionItem & {
  kind: "extension";
  placement?: ExtensionMenuContribution["placement"];
};

export const buildExtensionMenuActions = (input: {
  slotId: string;
  contributions: ExtensionMenuContribution[] | undefined;
  pendingCommandIds?: string[];
  onExecute: (contribution: ExtensionMenuContribution) => void;
}): ExtensionMenuActionItem[] => {
  const { slotId, contributions = [], pendingCommandIds = [], onExecute } = input;

  return contributions
    .filter((contribution) => contribution.slotId === slotId)
    .map((contribution) => {
      const isDisabled = pendingCommandIds.includes(contribution.commandId);
      return {
        key: contribution.id,
        label: contribution.label,
        kind: "extension" as const,
        placement: contribution.placement,
        ...(isDisabled ? { isDisabled } : {}),
        onClick: () => onExecute(contribution),
      };
    });
};

export const groupExtensionMenuActions = (
  actions: ExtensionMenuActionItem[],
  presentation: ExtensionMenuPresentation,
) => {
  if (presentation === "button-group") return { primary: actions, overflow: [] };
  return { primary: [], overflow: actions };
};

export const buildCommandOutcomeToasts = (
  label: string,
  outcome: CommandExecuteResponse["outcome"],
): CommandOutcomeToast[] => {
  if (outcome.notices?.length) {
    return outcome.notices.map((notice) => ({
      type: notice.type,
      title: notice.title ?? label,
      description: notice.message,
    }));
  }

  if (outcome.status === "success") {
    return [{ type: "success", title: label, description: "Extension command completed." }];
  }

  return [
    {
      type: outcome.status === "rejected" ? "warning" : "error",
      title: label,
      description: outcome.reason ?? "Extension command failed.",
    },
  ];
};

export const getExtensionNavigationForSlot = (navigation: ExtensionNavigationRecord[] | undefined, slotId: string) =>
  (navigation ?? []).filter((item) => item.slotId === slotId);

export const getExtensionViewsForSlot = (views: ExtensionViewRecord[] | undefined, slotId: string) =>
  (views ?? []).filter((item) => item.slotId === slotId);

export const buildSlotInvocation = (id: string, kind: SlotKind, context: Record<string, unknown>) => ({
  id,
  kind,
  context,
});
