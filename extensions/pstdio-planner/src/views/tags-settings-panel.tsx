import { Box, Button, Flex, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ScrollArea, TagEditorHeading, TagEditorSaveBar } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { runCommand } from "../hooks/use-command";
import {
  createTagSettingsDraft,
  hasTagDraftChanges,
  saveTagDraft,
  saveTagDraftWithRecovery,
  type TagSettingsDraft,
  type TagSettingsTag,
  tagSettingsDraftsVersion,
} from "./tag-settings-draft";
import { TagSettingsSection, type Translate } from "./tag-settings-section";
import { renderTicketRoot } from "./view-root";

const TAGS_KEY = ["tags"];

const commandIds = {
  read: "pstdio.pstdio-planner.command.ticket-tag.read",
  createTag: "pstdio.pstdio-planner.command.ticket-tag.create",
  deleteTag: "pstdio.pstdio-planner.command.ticket-tag.delete",
};

const run = <TResult,>(host: GuestHost, commandId: string, params?: Record<string, unknown>) =>
  runCommand<TResult>(host, commandId, params, "Ticket tag command failed.");

const readTags = async (host: GuestHost) => (await run<{ tags: TagSettingsTag[] }>(host, commandIds.read)).tags ?? [];

const buildDrafts = (tags: TagSettingsTag[]) =>
  Object.fromEntries(tags.map((tag) => [tag.id, createTagSettingsDraft(tag)]));

const TicketTagsSettingsPanel = (props: { host: GuestHost; t: Translate }) => {
  const { host, t } = props;
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, TagSettingsDraft>>({});

  const tagsQuery = useQuery({ queryKey: TAGS_KEY, queryFn: () => readTags(host) });
  const tags = tagsQuery.data ?? [];

  // Rebuild drafts only when the loaded tags change semantically; identity-only
  // refetches keep the user's in-progress edits.
  const tagsVersion = tagSettingsDraftsVersion(tags);
  const lastVersionRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastVersionRef.current === tagsVersion) return;
    lastVersionRef.current = tagsVersion;
    setDrafts(buildDrafts(tags));
  }, [tags, tagsVersion]);

  const invalidateTags = () => queryClient.invalidateQueries({ queryKey: TAGS_KEY });
  const changedTags = tags.filter((tag) => drafts[tag.id] && hasTagDraftChanges(tag, drafts[tag.id]));

  const createTag = useMutation({
    mutationFn: (name: string) => run(host, commandIds.createTag, { name, type: "single_select" }),
    onSuccess: invalidateTags,
  });
  const deleteTag = useMutation({
    mutationFn: (tagId: string) => run(host, commandIds.deleteTag, { tagId }),
    onSuccess: invalidateTags,
  });
  const saveTags = useMutation({
    mutationFn: () =>
      saveTagDraftWithRecovery(async () => {
        for (const tag of changedTags) {
          await saveTagDraft((commandId, params) => run(host, commandId, params), tag, drafts[tag.id]);
        }
      }, invalidateTags),
    onSuccess: invalidateTags,
  });

  const addTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName("");
    createTag.mutate(name);
  };

  const hasChanges = changedTags.length > 0;
  const queryError = tagsQuery.error ?? saveTags.error;
  const error = queryError ? String(queryError instanceof Error ? queryError.message : queryError) : null;

  return (
    <ScrollArea h="full" minH="0" bg="bg" color="fg" contentProps={{ p: "lg", spaceY: "lg", minH: "100%" }}>
      <Flex gap="sm" alignItems="flex-start" justifyContent="space-between">
        <Box minW="0">
          <TagEditorHeading hasChanges={hasChanges}>{t("settings.ticketTags.title", "Ticket tags")}</TagEditorHeading>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("settings.ticketTags.description", "Configure the tag definitions and options available on tickets.")}
          </Text>
        </Box>
        <TagEditorSaveBar
          hasChanges={hasChanges}
          isSaving={saveTags.isPending}
          resetLabel={t("settings.ticketTags.reset", "Reset")}
          saveLabel={t("settings.ticketTags.save", "Save")}
          onSave={() => saveTags.mutate()}
          onReset={() => setDrafts(buildDrafts(tags))}
        />
      </Flex>
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
          {/* Flat document flow: a hairline separates tag sections, no card per tag. */}
          {tags.map((tag, index) =>
            drafts[tag.id] ? (
              <Stack
                key={tag.id}
                borderColor="border.subtle"
                borderTopWidth={index > 0 ? "1px" : undefined}
                pt={index > 0 ? "md" : undefined}
              >
                <TagSettingsSection
                  tag={tag}
                  draft={drafts[tag.id]}
                  isSaving={saveTags.isPending}
                  t={t}
                  onDraftChange={(draft) => setDrafts({ ...drafts, [tag.id]: draft })}
                  onDeleteTag={() => deleteTag.mutate(tag.id)}
                />
              </Stack>
            ) : null,
          )}
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
