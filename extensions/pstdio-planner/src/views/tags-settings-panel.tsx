import { Box, Button, HStack, Icon, Input, Menu, Spinner, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ListRow, ScrollArea, TagEditor, type TagEditorValue } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { runCommand } from "../hooks/use-command";
import { renderTicketRoot } from "./view-root";

interface TagOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  icon: string | null;
}

interface TagDefinition {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: TagOption[];
}

type Translate = (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
type TagSelectionType = TagDefinition["type"];

const getTagTypeOptions = (t: Translate): Array<{ value: TagSelectionType; label: string }> => [
  { value: "single_select", label: t("settings.ticketTags.singleSelect", "Single-select") },
  { value: "multi_select", label: t("settings.ticketTags.multiSelect", "Multi-select") },
];

const tagTypeLabel = (type: TagSelectionType, t: Translate) =>
  getTagTypeOptions(t).find((option) => option.value === type)?.label ??
  t("settings.ticketTags.singleSelect", "Single-select");

const TagTypeDropdown = (props: {
  disabled?: boolean;
  label: string;
  size?: "2xs" | "sm";
  t: Translate;
  type: TagSelectionType;
  onChange: (type: TagSelectionType) => void;
}) => {
  const { disabled, label, size = "2xs", t, type, onChange } = props;
  const options = getTagTypeOptions(t);

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size={size} variant="outline" gap="xs" disabled={disabled} aria-label={label}>
          {tagTypeLabel(type, t)}
          <Icon as={ChevronDown} boxSize="12px" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="150px" bg="bg">
          {options.map((option) => (
            <Menu.Item key={option.value} value={option.value} asChild>
              <ListRow
                asChild
                variant="compact"
                id={option.value}
                label={option.label}
                isSelected={type === option.value}
                endContent={type === option.value ? <Check size={14} /> : undefined}
                onActivate={() => onChange(option.value)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

const TAGS_KEY = ["tags"];

const commandIds = {
  read: "pstdio-planner.ticketTag.read",
  createTag: "pstdio-planner.ticketTag.create",
  updateTag: "pstdio-planner.ticketTag.update",
  deleteTag: "pstdio-planner.ticketTag.delete",
  createOption: "pstdio-planner.ticketTag.createOption",
  updateOption: "pstdio-planner.ticketTag.updateOption",
  deleteOption: "pstdio-planner.ticketTag.deleteOption",
};

const run = <TResult,>(host: GuestHost, commandId: string, params?: Record<string, unknown>) =>
  runCommand<TResult>(host, commandId, params, "Ticket tag command failed.");

const readTags = async (host: GuestHost) => (await run<{ tags: TagDefinition[] }>(host, commandIds.read)).tags ?? [];

const toValues = (options: TagOption[]): TagEditorValue[] =>
  options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    icon: option.icon,
    sortOrder: option.sortOrder,
  }));

const optionChanged = (original: TagOption, draft: TagEditorValue) =>
  original.name !== draft.name || original.color !== draft.color || original.icon !== (draft.icon ?? null);

// Persists one tag's option edits by diffing the drafts against the saved options.
const saveTagOptions = async (
  host: GuestHost,
  tag: TagDefinition,
  drafts: TagEditorValue[],
  deletedIds: Set<string>,
) => {
  for (const optionId of deletedIds) await run(host, commandIds.deleteOption, { tagId: tag.id, optionId });
  for (const draft of drafts) {
    if (draft.isNew) {
      await run(host, commandIds.createOption, {
        tagId: tag.id,
        name: draft.name,
        color: draft.color,
        icon: draft.icon ?? null,
      });
      continue;
    }
    const original = tag.options.find((option) => option.id === draft.id);
    if (original && optionChanged(original, draft)) {
      await run(host, commandIds.updateOption, {
        tagId: tag.id,
        optionId: draft.id,
        name: draft.name,
        color: draft.color,
        icon: draft.icon ?? null,
      });
    }
  }
};

const TagSection = (props: { host: GuestHost; tag: TagDefinition; t: Translate }) => {
  const { host, tag, t } = props;
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<TagEditorValue[]>(toValues(tag.options));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const invalidateTags = () => queryClient.invalidateQueries({ queryKey: TAGS_KEY });
  const deleteTag = useMutation({
    mutationFn: () => run(host, commandIds.deleteTag, { tagId: tag.id }),
    onSuccess: invalidateTags,
  });
  const updateTag = useMutation({
    mutationFn: (type: TagSelectionType) => run(host, commandIds.updateTag, { tagId: tag.id, type }),
    onSuccess: invalidateTags,
  });
  const saveOptions = useMutation({
    mutationFn: () => saveTagOptions(host, tag, drafts, deletedIds),
    onSuccess: () => {
      setDeletedIds(new Set());
      return invalidateTags();
    },
  });

  const hasChanges =
    deletedIds.size > 0 ||
    drafts.some((draft) => {
      if (draft.isNew) return true;
      const original = tag.options.find((option) => option.id === draft.id);
      return !original || optionChanged(original, draft);
    });

  return (
    <Stack gap="sm" borderWidth="1px" borderColor="border" borderRadius="md" p="md">
      <HStack justify="space-between">
        <HStack gap="xs">
          <Text textStyle="label/M/medium">{tag.name}</Text>
          <TagTypeDropdown
            type={tag.type}
            t={t}
            label={t("settings.ticketTags.selectionModeForTag", "Selection mode for {{tag}}", { tag: tag.name })}
            disabled={updateTag.isPending}
            onChange={(type) => {
              if (type !== tag.type) updateTag.mutate(type);
            }}
          />
        </HStack>
        <Button size="2xs" variant="ghost" colorPalette="red" onClick={() => deleteTag.mutate()}>
          {t("settings.ticketTags.deleteTag", "Delete tag")}
        </Button>
      </HStack>
      <TagEditor
        title={t("settings.ticketTags.options", "Options")}
        values={drafts}
        onValuesChange={setDrafts}
        onDeleteValue={(option) => {
          if (!option.isNew) setDeletedIds(new Set([...deletedIds, option.id]));
          setDrafts(drafts.filter((draft) => draft.id !== option.id));
        }}
        hasChanges={hasChanges}
        isSaving={saveOptions.isPending}
        addLabel={t("settings.ticketTags.addOption", "Add option")}
        addPlaceholder={t("settings.ticketTags.optionName", "Option name")}
        deleteHeadline={t("settings.ticketTags.deleteOptionHeadline", "Delete tag option?")}
        deleteNotificationText={(option) =>
          t("settings.ticketTags.deleteOptionNotificationText", 'Remove the "{{option}}" option from "{{tag}}".', {
            option: option.name,
            tag: tag.name,
          })
        }
        deleteButtonText={t("settings.ticketTags.deleteOption", "Delete option")}
        onSave={() => saveOptions.mutate()}
        onCancel={() => {
          setDrafts(toValues(tag.options));
          setDeletedIds(new Set());
        }}
      />
    </Stack>
  );
};

const TicketTagsSettingsPanel = (props: { host: GuestHost; t: Translate }) => {
  const { host, t } = props;
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<TagSelectionType>("single_select");

  const tagsQuery = useQuery({ queryKey: TAGS_KEY, queryFn: () => readTags(host) });
  const createTag = useMutation({
    mutationFn: (input: { name: string; type: TagSelectionType }) =>
      run(host, commandIds.createTag, { name: input.name, type: input.type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });

  const addTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName("");
    createTag.mutate({ name, type: newTagType });
  };

  const error = tagsQuery.error
    ? String(tagsQuery.error instanceof Error ? tagsQuery.error.message : tagsQuery.error)
    : null;

  return (
    <ScrollArea h="full" minH="0" bg="bg" color="fg" contentProps={{ p: "lg", spaceY: "lg", minH: "100%" }}>
      <Box>
        <Text textStyle="label/L/medium">{t("settings.ticketTags.title", "Ticket tags")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("settings.ticketTags.description", "Configure the tag definitions and options available on tickets.")}
        </Text>
      </Box>
      {error ? (
        <AlertMessage
          status="error"
          colorPalette="red"
          title={t("settings.ticketTags.errorTitle", "Unable to update ticket tags")}
          size="sm"
        >
          {error}
        </AlertMessage>
      ) : null}
      {tagsQuery.isPending ? (
        <HStack gap="sm" color="fg.muted">
          <Spinner size="sm" />
          <Text textStyle="paragraph/S/regular">{t("settings.ticketTags.loading", "Loading...")}</Text>
        </HStack>
      ) : (
        <Stack gap="md">
          {(tagsQuery.data ?? []).map((tag) => (
            <TagSection key={tag.id} host={host} tag={tag} t={t} />
          ))}
          <HStack gap="sm">
            <Input
              size="sm"
              value={newTagName}
              placeholder={t("settings.ticketTags.newTagName", "New tag name")}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <TagTypeDropdown
              type={newTagType}
              t={t}
              label={t("settings.ticketTags.newTagSelectionMode", "Selection mode for new tag")}
              size="sm"
              disabled={createTag.isPending}
              onChange={setNewTagType}
            />
            <Button size="sm" onClick={addTag} disabled={!newTagName.trim() || createTag.isPending}>
              {t("settings.ticketTags.addTag", "Add tag")}
            </Button>
          </HStack>
        </Stack>
      )}
    </ScrollArea>
  );
};

export default defineExtensionView({
  render({ mount, host, t }) {
    return renderTicketRoot(mount, <TicketTagsSettingsPanel host={host} t={t} />);
  },
});
