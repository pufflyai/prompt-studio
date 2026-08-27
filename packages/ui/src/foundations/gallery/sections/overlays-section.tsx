import { Box, Button, HStack, Menu, Popover, Stack, Text } from "@chakra-ui/react";
import { Archive, Copy, FileText, GitBranch, Lock, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { PaletteShortcut } from "@/components/command-palette/palette-shortcut";
import { DeleteConfirmationModal } from "@/components/overlays/delete-confirmation-modal";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { SearchableMenu, type SearchableMenuItem } from "@/components/overlays/searchable-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import { GalleryCard, GallerySection } from "../gallery-frame";

const branchItems: SearchableMenuItem[] = [
  { id: "main", label: "main", icon: GitBranch, searchText: "origin/main", isSelected: true },
  { id: "feature", label: "feature/search", icon: GitBranch, searchText: "origin/feature" },
  { id: "locked", label: "release/locked", icon: Lock, searchText: "origin/release/locked", isDisabled: true },
];

const DeleteModalDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Box>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Open delete dialog
      </Button>
      <DeleteConfirmationModal
        open={open}
        onClose={() => setOpen(false)}
        onDelete={() => setOpen(false)}
        headline="Delete pipeline?"
        notificationText="Deleting this pipeline removes all versions. This cannot be undone."
        buttonText="Delete pipeline"
      />
    </Box>
  );
};

export const OverlaysSection = () => {
  return (
    <GallerySection title="Overlays & menus" description="Tooltips, menus, context actions, and dialogs.">
      <GalleryCard title="Tooltip & shortcut" names={["Tooltip", "PaletteShortcut"]}>
        <HStack gap="md" alignItems="center">
          <Tooltip content="Click to copy this link">
            <Button size="sm" variant="ghost">
              <Copy size={16} />
            </Button>
          </Tooltip>
          <PaletteShortcut binding="Mod+P" />
        </HStack>
      </GalleryCard>

      <GalleryCard title="Searchable menu" names={["SearchableMenu"]}>
        <SearchableMenu
          trigger={<Button variant="outline">Select branch</Button>}
          items={branchItems}
          searchPlaceholder="Search branches…"
          emptyState={
            <Box padding="sm">
              <Text textStyle="label/S/regular" color="fg.muted">
                No branches found
              </Text>
            </Box>
          }
        />
      </GalleryCard>

      <GalleryCard title="Dropdown menu" names={["Menu.Root", "Menu.Content"]}>
        <Stack gap="sm" alignItems="flex-start" width="100%">
          <Menu.Root defaultOpen positioning={{ placement: "bottom-start" }}>
            <Menu.Trigger asChild>
              <Button variant="outline">Open menu</Button>
            </Menu.Trigger>
            <Menu.Content position="static" minWidth="180px" bg="bg">
              <Menu.Item value="rename">
                <Pencil size={14} />
                Rename
              </Menu.Item>
              <Menu.Item value="duplicate">
                <Copy size={14} />
                Duplicate
              </Menu.Item>
              <Menu.Item value="archive">
                <Archive size={14} />
                Archive
              </Menu.Item>
              <Menu.Item value="locked" disabled>
                <Lock size={14} />
                Locked item
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </Stack>
      </GalleryCard>

      <GalleryCard title="Popover" names={["Popover.Root", "Popover.Content"]}>
        <Stack gap="sm" alignItems="flex-start" width="100%">
          <Popover.Root defaultOpen positioning={{ placement: "bottom-start" }}>
            <Popover.Trigger asChild>
              <Button variant="outline">Open popover</Button>
            </Popover.Trigger>
            <Popover.Content position="static" width="220px" p="sm" bg="bg">
              <Stack gap="2xs">
                <Text textStyle="label/S/medium">Display settings</Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Density, sorting, and visible fields.
                </Text>
              </Stack>
            </Popover.Content>
          </Popover.Root>
        </Stack>
      </GalleryCard>

      <GalleryCard title="Context menu" names={["ResourceContextMenu"]}>
        <ResourceContextMenu
          actions={[
            { key: "copy", label: "Copy", icon: <Copy size={14} />, onClick: () => {} },
            { key: "delete", label: "Delete", icon: <Trash2 size={14} />, onClick: () => {}, separatorBefore: true },
          ]}
        >
          <HStack gap="xs" borderWidth="1px" borderColor="border.subtle" borderRadius="sm" padding="sm">
            <FileText size={14} />
            <Text textStyle="label/S/regular">Right-click this row</Text>
          </HStack>
        </ResourceContextMenu>
      </GalleryCard>

      <GalleryCard title="Dialog" names={["DeleteConfirmationModal"]}>
        <DeleteModalDemo />
      </GalleryCard>
    </GallerySection>
  );
};
