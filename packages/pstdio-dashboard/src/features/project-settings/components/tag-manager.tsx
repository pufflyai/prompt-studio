import { Badge, Button, Flex, HStack, Icon, Input, Menu, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, MenuItem, toaster } from "@pstdio/ui";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  useCreateProjectTicketTag,
  useDeleteProjectTicketTag,
  useUpdateProjectTicketTag,
} from "@/features/ticket-list/hooks/use-project-tickets";
import type { TicketStatusColor, TicketTag } from "@/features/ticket-list/types";

const TAG_COLORS: TicketStatusColor[] = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "cyan",
  "purple",
  "pink",
];

interface TagManagerProps {
  projectId: string | undefined;
  tags: TicketTag[];
}

interface TagFormState {
  name: string;
  color: TicketStatusColor;
}

const ColorPicker = (props: { value: TicketStatusColor; onChange: (color: TicketStatusColor) => void }) => {
  const { value, onChange } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="xs" variant="outline" gap="xs">
          <Badge colorPalette={value} variant="solid" size="sm" borderRadius="full" px="2" />
          {value}
          <Icon as={ChevronDown} boxSize="14px" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="120px" bg="bg">
          {TAG_COLORS.map((color) => (
            <MenuItem
              key={color}
              id={color}
              primaryLabel={color}
              isSelected={color === value}
              leftSlot={<Badge colorPalette={color} variant="solid" size="sm" borderRadius="full" px="2" />}
              onClick={() => onChange(color)}
            />
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export const TagManager = (props: TagManagerProps) => {
  const { projectId, tags } = props;
  const createTag = useCreateProjectTicketTag(projectId);
  const updateTag = useUpdateProjectTicketTag(projectId);
  const deleteTag = useDeleteProjectTicketTag(projectId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TagFormState>({ name: "", color: "blue" });
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  const tagToDelete = tags.find((t) => t.id === deleteTagId);

  const handleStartAdd = () => {
    setEditingTagId(null);
    setFormState({ name: "", color: "blue" });
    setIsAdding(true);
  };

  const handleStartEdit = (tag: TicketTag) => {
    setIsAdding(false);
    setEditingTagId(tag.id);
    setFormState({ name: tag.name, color: tag.color });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingTagId(null);
  };

  const handleSaveNew = async () => {
    if (!formState.name.trim()) return;

    try {
      await createTag.mutateAsync({ name: formState.name.trim(), color: formState.color });
      setIsAdding(false);
      setFormState({ name: "", color: "blue" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create tag.";
      toaster.create({ type: "error", title: "Create tag failed", description: message });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTagId || !formState.name.trim()) return;
    const tag = tags.find((t) => t.id === editingTagId);
    if (!tag) return;

    try {
      await updateTag.mutateAsync({ tag, name: formState.name.trim(), color: formState.color });
      setEditingTagId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update tag.";
      toaster.create({ type: "error", title: "Update tag failed", description: message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTagId) return;
    try {
      await deleteTag.mutateAsync(deleteTagId);
      setDeleteTagId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete tag.";
      toaster.create({ type: "error", title: "Delete tag failed", description: message });
      throw error;
    }
  };

  const isMutating = createTag.isPending || updateTag.isPending || deleteTag.isPending;

  return (
    <>
      <Stack gap="md" padding="lg" height="100%">
        <Flex justifyContent="space-between" alignItems="center">
          <Stack gap="2xs">
            <Text textStyle="heading/S">Tags</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              Manage tags used to categorize tickets.
            </Text>
          </Stack>
          <Button size="sm" variant="outline" onClick={handleStartAdd} disabled={isAdding || isMutating}>
            <Plus size={16} />
            Add tag
          </Button>
        </Flex>

        <Stack gap="xs">
          {tags.map((tag) =>
            editingTagId === tag.id ? (
              <TagFormRow
                key={tag.id}
                formState={formState}
                onFormChange={setFormState}
                onSave={handleSaveEdit}
                onCancel={handleCancel}
                isSaving={updateTag.isPending}
              />
            ) : (
              <HStack key={tag.id} gap="sm" padding="xs" borderRadius="xs" _hover={{ bg: "bg.muted" }}>
                <Badge colorPalette={tag.color} variant="subtle">
                  {tag.name}
                </Badge>
                <HStack gap="2xs" marginLeft="auto">
                  <Button
                    size="2xs"
                    variant="ghost"
                    onClick={() => handleStartEdit(tag)}
                    disabled={isMutating}
                    aria-label={`Edit ${tag.name}`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="2xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => setDeleteTagId(tag.id)}
                    disabled={isMutating}
                    aria-label={`Delete ${tag.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </HStack>
              </HStack>
            ),
          )}

          {isAdding && (
            <TagFormRow
              formState={formState}
              onFormChange={setFormState}
              onSave={handleSaveNew}
              onCancel={handleCancel}
              isSaving={createTag.isPending}
            />
          )}

          {tags.length === 0 && !isAdding && (
            <Text textStyle="paragraph/S/regular" color="fg.muted" padding="sm">
              No tags yet. Create one to get started.
            </Text>
          )}
        </Stack>
      </Stack>

      <DeleteConfirmationModal
        open={Boolean(deleteTagId)}
        onClose={() => setDeleteTagId(null)}
        onDelete={handleDelete}
        headline="Delete tag?"
        notificationText={`This will remove the tag "${tagToDelete?.name ?? ""}" from all tickets.`}
        buttonText="Delete tag"
      />
    </>
  );
};

interface TagFormRowProps {
  formState: TagFormState;
  onFormChange: (state: TagFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const TagFormRow = (props: TagFormRowProps) => {
  const { formState, onFormChange, onSave, onCancel, isSaving } = props;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <HStack gap="sm" padding="xs" borderWidth="1px" borderRadius="xs">
      <Input
        size="sm"
        placeholder="Tag name"
        value={formState.name}
        onChange={(e) => onFormChange({ ...formState, name: e.target.value })}
        onKeyDown={handleKeyDown}
        autoFocus
        flex="1"
      />
      <ColorPicker value={formState.color} onChange={(color) => onFormChange({ ...formState, color })} />
      <Button size="xs" variant="solid" onClick={onSave} loading={isSaving} disabled={!formState.name.trim()}>
        Save
      </Button>
      <Button size="xs" variant="ghost" onClick={onCancel} disabled={isSaving}>
        <X size={14} />
      </Button>
    </HStack>
  );
};
