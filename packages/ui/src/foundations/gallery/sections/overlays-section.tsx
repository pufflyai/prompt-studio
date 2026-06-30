import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { Copy, FileText, GitBranch, Trash2 } from "lucide-react";
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
];

const DeleteModalDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <Box>
      <Button size="sm" variant="outline" colorPalette="red" onClick={() => setOpen(true)}>
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
          <Tooltip content="Click to copy this link" showArrow>
            <Button size="sm" variant="ghost">
              <Copy size={16} />
            </Button>
          </Tooltip>
          <PaletteShortcut binding="Mod+K" />
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

      <GalleryCard title="Context menu" names={["ResourceContextMenu"]}>
        <ResourceContextMenu
          actions={[
            { key: "copy", label: "Copy", icon: <Copy size={14} />, onClick: () => {} },
            { key: "delete", label: "Delete", icon: <Trash2 size={14} />, onClick: () => {}, separatorBefore: true },
          ]}
        >
          <HStack gap="xs" borderWidth="1px" borderColor="border.muted" borderRadius="sm" padding="sm">
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
