import { Icon } from "@chakra-ui/react";
import type { ResourceContextAction, TreeListSection } from "@pstdio/ui";

export const createTreeBackgroundActions = (
  visibleSections: TreeListSection[],
  backgroundContextActions: ResourceContextAction[],
) => [
  ...visibleSections.flatMap((section) =>
    (section.contextMenuItems ?? []).map((item) => ({
      key: `${section.id}:${item.id}`,
      label: item.label,
      commandId: item.commandId,
      group: item.group,
      icon: typeof item.icon === "function" ? <Icon as={item.icon} boxSize="16px" /> : item.icon,
      endContent: item.endContent,
      separatorBefore: item.separatorBefore,
      isDisabled: item.disabled,
      onSelect: item.runOnSelect ? item.onAction : undefined,
      onClick: item.runOnSelect ? undefined : item.onAction,
      closeOnSelect: true,
    })),
  ),
  ...backgroundContextActions,
];
