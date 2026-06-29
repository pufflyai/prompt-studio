import { Box, Button, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ScrollArea, TagEditor, type TagEditorValue } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { runCommand } from "../hooks/use-command";
import {
  createTagSettingsDraft,
  DEFAULT_TAG_OPTION_ICON,
  hasTagDraftChanges,
  saveTagDraft,
  saveTagDraftWithRecovery,
  type TagSettingsTagType,
  tagSettingsDraftVersion,
} from "./tag-settings-draft";
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

const TAGS_KEY = ["tags"];

const commandIds = {
  read: "pstdio-planner.ticketTag.read",
  createTag: "pstdio-planner.ticketTag.create",
  deleteTag: "pstdio-planner.ticketTag.delete",
};

const run = <TResult,>(host: GuestHost, commandId: string, params?: Record<string, unknown>) =>
  runCommand<TResult>(host, commandId, params, "Ticket tag command failed.");

const readTags = async (host: GuestHost) => (await run<{ tags: TagDefinition[] }>(host, commandIds.read)).tags ?? [];

type Translate = (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;

const tagTypeOptions = [
  { value: "single_select", key: "settings.ticketTags.singleSelect", fallback: "Single" },
  { value: "multi_select", key: "settings.ticketTags.multiSelect", fallback: "Multiple" },
] satisfies Array<{ value: TagSettingsTagType; key: string; fallback: string }>;

const TagTypeControl = (props: {
  value: TagSettingsTagType;
  isDisabled?: boolean;
  t: Translate;
  onChange: (value: TagSettingsTagType) => void;
}) => {
  const { value, isDisabled, t, onChange } = props;

  return (
    <HStack gap="2xs" borderWidth="1px" borderColor="border" borderRadius="sm" p="2xs">
      {tagTypeOptions.map((option) => (
        <Button
          key={option.value}
          size="2xs"
          variant={value === option.value ? "solid" : "ghost"}
          aria-pressed={value === option.value}
          disabled={isDisabled}
          onClick={() => onChange(option.value)}
        >
          {t(option.key, option.fallback)}
        </Button>
      ))}
    </HStack>
  );
};

const TagSection = (props: { host: GuestHost; tag: TagDefinition; t: Translate }) => {
  const { host, tag, t } = props;
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<TagEditorValue[]>(() => createTagSettingsDraft(tag).options);
  const [draftType, setDraftType] = useState<TagSettingsTagType>(() => createTagSettingsDraft(tag).type);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => createTagSettingsDraft(tag).deletedIds);
  const draft = { type: draftType, options: drafts, deletedIds };

  // Reset only when the backing tag's semantic content changes; identity-only
  // refetches keep the user's in-progress edits.
  const tagVersion = tagSettingsDraftVersion(tag);
  const lastResetVersionRef = useRef(tagVersion);
  useEffect(() => {
    if (lastResetVersionRef.current === tagVersion) return;
    lastResetVersionRef.current = tagVersion;
    const nextDraft = createTagSettingsDraft(tag);
    setDrafts(nextDraft.options);
    setDraftType(nextDraft.type);
    setDeletedIds(nextDraft.deletedIds);
  }, [tag, tagVersion]);

  const invalidateTags = () => queryClient.invalidateQueries({ queryKey: TAGS_KEY });
  const deleteTag = useMutation({
    mutationFn: () => run(host, commandIds.deleteTag, { tagId: tag.id }),
    onSuccess: invalidateTags,
  });
  const saveOptions = useMutation({
    mutationFn: () =>
      saveTagDraftWithRecovery(
        () => saveTagDraft((commandId, params) => run(host, commandId, params), tag, draft),
        invalidateTags,
      ),
    onSuccess: () => {
      setDeletedIds(new Set());
      return invalidateTags();
    },
  });

  const hasChanges = hasTagDraftChanges(tag, draft);

  return (
    <Stack gap="sm" borderWidth="1px" borderColor="border" borderRadius="md" p="md">
      <HStack justify="space-between">
        <HStack gap="xs">
          <Text textStyle="label/M/medium">{tag.name}</Text>
          <TagTypeControl value={draftType} isDisabled={saveOptions.isPending} t={t} onChange={setDraftType} />
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
        defaultAddIcon={DEFAULT_TAG_OPTION_ICON}
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
          const nextDraft = createTagSettingsDraft(tag);
          setDrafts(nextDraft.options);
          setDraftType(nextDraft.type);
          setDeletedIds(nextDraft.deletedIds);
        }}
      />
    </Stack>
  );
};

const TicketTagsSettingsPanel = (props: { host: GuestHost; t: Translate }) => {
  const { host, t } = props;
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");

  const tagsQuery = useQuery({ queryKey: TAGS_KEY, queryFn: () => readTags(host) });
  const createTag = useMutation({
    mutationFn: (name: string) => run(host, commandIds.createTag, { name, type: "single_select" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  });

  const addTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName("");
    createTag.mutate(name);
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
            <Button size="sm" onClick={addTag} disabled={!newTagName.trim()}>
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
