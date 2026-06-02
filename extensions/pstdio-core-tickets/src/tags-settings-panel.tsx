import "@pstdio/ui/style.css";

import { Badge, Box, Button, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import {
  type CommandResponse,
  defineExtensionView,
  type GuestHost,
  unwrapCommandOutcome,
} from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme, TagEditor, type TagEditorValue } from "@pstdio/ui";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface TagOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

interface TagDefinition {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: TagOption[];
}

const commandIds = {
  read: "pstdio-core-tickets.ticketTag.read",
  createTag: "pstdio-core-tickets.ticketTag.create",
  deleteTag: "pstdio-core-tickets.ticketTag.delete",
  createOption: "pstdio-core-tickets.ticketTag.createOption",
  updateOption: "pstdio-core-tickets.ticketTag.updateOption",
  deleteOption: "pstdio-core-tickets.ticketTag.deleteOption",
};

const run = async <TResult,>(host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<CommandResponse<TResult>>("commands.execute", { commandId, params });
  return unwrapCommandOutcome(response, "Ticket tag command failed.");
};

const readTags = async (host: GuestHost) => (await run<{ tags: TagDefinition[] }>(host, commandIds.read)).tags ?? [];

const toValues = (options: TagOption[]): TagEditorValue[] =>
  options.map((option) => ({ id: option.id, name: option.name, color: option.color, sortOrder: option.sortOrder }));

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
      await run(host, commandIds.createOption, { tagId: tag.id, name: draft.name, color: draft.color });
      continue;
    }
    const original = tag.options.find((option) => option.id === draft.id);
    if (original && (original.name !== draft.name || original.color !== draft.color)) {
      await run(host, commandIds.updateOption, {
        tagId: tag.id,
        optionId: draft.id,
        name: draft.name,
        color: draft.color,
      });
    }
  }
};

const TagSection = (props: { host: GuestHost; tag: TagDefinition; onChanged: () => Promise<void> }) => {
  const { host, tag, onChanged } = props;
  const [drafts, setDrafts] = useState<TagEditorValue[]>(toValues(tag.options));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const hasChanges =
    deletedIds.size > 0 ||
    drafts.some((draft) => {
      if (draft.isNew) return true;
      const original = tag.options.find((option) => option.id === draft.id);
      return !original || original.name !== draft.name || original.color !== draft.color;
    });

  return (
    <Stack gap="sm" borderWidth="1px" borderColor="border" borderRadius="md" p="md">
      <HStack justify="space-between">
        <HStack gap="xs">
          <Text textStyle="label/M/medium">{tag.name}</Text>
          <Badge variant="subtle" colorPalette="gray">
            {tag.type === "multi_select" ? "Multi-select" : "Single-select"}
          </Badge>
        </HStack>
        <Button
          size="2xs"
          variant="ghost"
          colorPalette="red"
          onClick={() => void run(host, commandIds.deleteTag, { tagId: tag.id }).then(onChanged)}
        >
          Delete tag
        </Button>
      </HStack>
      <TagEditor
        title="Options"
        values={drafts}
        onValuesChange={setDrafts}
        onDeleteValue={(option) => {
          if (!option.isNew) setDeletedIds(new Set([...deletedIds, option.id]));
          setDrafts(drafts.filter((draft) => draft.id !== option.id));
        }}
        hasChanges={hasChanges}
        isSaving={saving}
        showIcons={false}
        addLabel="Add option"
        addPlaceholder="Option name"
        deleteHeadline="Delete tag option?"
        deleteNotificationText={(option) => `Remove the "${option.name}" option from "${tag.name}".`}
        deleteButtonText="Delete option"
        onSave={async () => {
          setSaving(true);
          try {
            await saveTagOptions(host, tag, drafts, deletedIds);
            setDeletedIds(new Set());
            await onChanged();
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => {
          setDrafts(toValues(tag.options));
          setDeletedIds(new Set());
        }}
      />
    </Stack>
  );
};

const TicketTagsSettingsPanel = (props: { host: GuestHost }) => {
  const { host } = props;
  const [tags, setTags] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");

  const refresh = async () => {
    setError(null);
    try {
      setTags(await readTags(host));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await readTags(host);
        if (!cancelled) setTags(next);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName("");
    await run(host, commandIds.createTag, { name, type: "single_select" });
    await refresh();
  };

  return (
    <Stack boxSizing="border-box" minH="100%" p="lg" gap="lg" bg="bg" color="fg">
      <Box>
        <Text textStyle="label/L/medium">Ticket tags</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Configure the tag definitions and options available on tickets.
        </Text>
      </Box>
      {error ? (
        <AlertMessage status="error" colorPalette="red" title="Unable to update ticket tags" size="sm">
          {error}
        </AlertMessage>
      ) : null}
      {loading ? (
        <HStack gap="sm" color="fg.muted">
          <Spinner size="sm" />
          <Text textStyle="paragraph/S/regular">Loading...</Text>
        </HStack>
      ) : (
        <Stack gap="md">
          {tags.map((tag) => (
            <TagSection key={tag.id} host={host} tag={tag} onChanged={refresh} />
          ))}
          <HStack gap="sm">
            <Input
              size="sm"
              value={newTagName}
              placeholder="New tag name"
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <Button size="sm" onClick={() => void addTag()} disabled={!newTagName.trim()}>
              Add tag
            </Button>
          </HStack>
        </Stack>
      )}
    </Stack>
  );
};

export default defineExtensionView({
  render({ mount, host }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <TicketTagsSettingsPanel host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
