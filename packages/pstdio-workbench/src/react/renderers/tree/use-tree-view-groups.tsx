import {
  type ResourceContextAction,
  type TreeListActionMenuItem,
  type TreeListGroup,
  type TreeListSection,
  useTreeListOrderStore,
} from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../../shared/icon";
import { activeTreeGroupLayout } from "./tree-group-scope";

interface GroupDraft {
  storageKey: string;
  group: TreeListGroup;
  isNew: boolean;
}

export const useTreeViewGroups = (
  storageKey: string,
  sections: TreeListSection[],
  nodeOrderBySection: Record<string, string[]>,
  enabled: boolean,
) => {
  const savedGroups = useTreeListOrderStore(storageKey, (state) => state.groups);
  const addGroup = useTreeListOrderStore(storageKey, (state) => state.addGroup);
  const renameGroup = useTreeListOrderStore(storageKey, (state) => state.renameGroup);
  const removeGroup = useTreeListOrderStore(storageKey, (state) => state.removeGroup);
  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const currentDraft = draft?.storageKey === storageKey ? draft : null;
  const { groups, nodeOrderBySection: activeNodeOrder } = activeTreeGroupLayout(
    sections,
    savedGroups,
    nodeOrderBySection,
  );
  if (currentDraft?.isNew) groups.push(currentDraft.group);

  const startGroup = (moveScope = sections[0]?.moveScope) => {
    setDraft({
      storageKey,
      group: { id: `tree-list-group:${crypto.randomUUID()}`, label: "New group", moveScope },
      isNew: true,
    });
  };
  const newGroupAction: ResourceContextAction = {
    key: "tree-group:new",
    label: "New group",
    icon: <WorkbenchIcon name="folder-plus" size={14} />,
    closeOnSelect: true,
    onClick: () => startGroup(),
  };

  const withGroupControls = (orderedSections: TreeListSection[]) =>
    orderedSections.map((section) => {
      const group = groups.find((group) => group.id === section.id);
      if (!group) return section;
      const menuItems: TreeListActionMenuItem[] = [
        {
          id: "tree-group:new",
          label: "New group",
          icon: newGroupAction.icon,
          onAction: () => startGroup(group.moveScope),
        },
        {
          id: "tree-group:rename",
          label: "Rename group",
          icon: <WorkbenchIcon name="pencil" size={14} />,
          separatorBefore: true,
          onAction: () => setDraft({ storageKey, group, isNew: false }),
        },
        {
          id: "tree-group:remove",
          label: "Remove group",
          icon: <WorkbenchIcon name="trash-2" size={14} />,
          onAction: () => removeGroup(group.id),
        },
      ];
      const editing = currentDraft?.group.id === group.id;
      return {
        ...section,
        canReorder: !editing,
        contextMenuItems: menuItems,
        actions: [
          {
            id: "tree-group:actions",
            label: "Group actions",
            icon: <WorkbenchIcon name="ellipsis" size={14} />,
            menuItems,
          },
        ],
        inlineInput: editing
          ? {
              ariaLabel: "Group name",
              placeholder: "New group",
              defaultValue: currentDraft.isNew ? "" : group.label,
              onCommit: (label: string) => {
                if (currentDraft.isNew)
                  addGroup(
                    { ...group, label },
                    orderedSections.map((section) => section.id),
                  );
                else renameGroup(group.id, label);
                setDraft(null);
              },
              onCancel: () => setDraft(null),
            }
          : undefined,
      };
    });

  return {
    groups,
    nodeOrderBySection: activeNodeOrder,
    withGroupControls,
    newGroupAction: enabled ? newGroupAction : undefined,
  };
};
