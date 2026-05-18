import { Badge, Button, HStack, Menu, Portal, Text } from "@chakra-ui/react";
import type { WorkbenchSavedView } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

interface SavedViewMenuProps {
  activeView?: WorkbenchSavedView;
  dirty: boolean;
  onSave: () => Promise<void> | void;
  onSaveAs: (name: string) => Promise<void> | void;
  onRename: (name: string) => Promise<void> | void;
  onDuplicate: (name?: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}

const askForName = (label: string, initial: string) => globalThis.prompt?.(label, initial)?.trim();

export const SavedViewMenu = (props: SavedViewMenuProps) => {
  const { activeView, dirty, onSave, onSaveAs, onRename, onDuplicate, onDelete } = props;
  const label = activeView?.name ?? "Unsaved view";

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="sm" variant="ghost" minW="0" maxW="220px">
          <WorkbenchIcon name="Table" size={14} />
          <Text as="span" truncate>
            {label}
          </Text>
          {dirty ? (
            <Badge size="sm" variant="subtle">
              Unsaved
            </Badge>
          ) : null}
          <WorkbenchIcon name="ChevronDown" size={14} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px" bg="bg">
            <Menu.Item value="save" disabled={!activeView || !dirty} onClick={() => void onSave()}>
              <HStack gap="xs">
                <WorkbenchIcon name="Save" size={14} />
                <Text textStyle="label/S/regular">Save</Text>
              </HStack>
            </Menu.Item>
            <Menu.Item
              value="save-as"
              onClick={() => {
                const name = askForName("View name", activeView ? `${activeView.name} Copy` : "Tickets view");
                if (name) void onSaveAs(name);
              }}
            >
              <HStack gap="xs">
                <WorkbenchIcon name="CopyPlus" size={14} />
                <Text textStyle="label/S/regular">Save as</Text>
              </HStack>
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item
              value="rename"
              disabled={!activeView}
              onClick={() => {
                if (!activeView) return;
                const name = askForName("View name", activeView.name);
                if (name) void onRename(name);
              }}
            >
              <HStack gap="xs">
                <WorkbenchIcon name="Pencil" size={14} />
                <Text textStyle="label/S/regular">Rename</Text>
              </HStack>
            </Menu.Item>
            <Menu.Item
              value="duplicate"
              disabled={!activeView}
              onClick={() => {
                if (!activeView) return;
                void onDuplicate(`${activeView.name} Copy`);
              }}
            >
              <HStack gap="xs">
                <WorkbenchIcon name="Copy" size={14} />
                <Text textStyle="label/S/regular">Duplicate</Text>
              </HStack>
            </Menu.Item>
            <Menu.Item
              value="delete"
              disabled={!activeView}
              color="fg.error"
              onClick={() => {
                if (!activeView || !globalThis.confirm?.(`Delete ${activeView.name}?`)) return;
                void onDelete();
              }}
            >
              <HStack gap="xs">
                <WorkbenchIcon name="Trash2" size={14} />
                <Text textStyle="label/S/regular">Delete</Text>
              </HStack>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
