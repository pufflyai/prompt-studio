import "@pstdio/ui/style.css";

import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme, StatusOptionEditor, type StatusOptionEditorItem } from "@pstdio/ui";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface TicketStatusCommandResponse {
  outcome: {
    ok: boolean;
    reason?: string;
    status: "success" | "rejected" | "error";
    value?: unknown;
  };
}

interface TicketStatusDefinition {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

interface TicketStatusReadModel {
  statuses: TicketStatusDefinition[];
}

interface SaveTicketStatusDefinitionsInput {
  deletedIds: Set<string>;
  drafts: StatusOptionEditorItem[];
  host: GuestHost;
  statuses: TicketStatusDefinition[];
}

interface LoadTicketStatusesInput {
  host: GuestHost;
  isCancelled?: () => boolean;
  setDrafts: (statuses: StatusOptionEditorItem[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setStatuses: (statuses: TicketStatusDefinition[]) => void;
}

const commandIds = {
  create: "pstdio-core-tickets.ticketStatus.create",
  delete: "pstdio-core-tickets.ticketStatus.delete",
  read: "pstdio-core-tickets.ticketStatus.read",
  reorder: "pstdio-core-tickets.ticketStatus.reorder",
  update: "pstdio-core-tickets.ticketStatus.update",
};

const bySortOrder = (left: TicketStatusDefinition, right: TicketStatusDefinition) =>
  left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);

const toEditorItems = (statuses: TicketStatusDefinition[]): StatusOptionEditorItem[] =>
  statuses
    .slice()
    .sort(bySortOrder)
    .map((status) => ({ id: status.id, name: status.name, color: status.color, sortOrder: status.sortOrder }));

const findOriginalStatus = (statuses: TicketStatusDefinition[], draft: StatusOptionEditorItem) =>
  statuses.find((status) => status.id === draft.id);

const statusNeedsUpdate = (original: TicketStatusDefinition, draft: StatusOptionEditorItem) =>
  draft.name !== original.name || draft.color !== original.color;

const hasStatusDefinitionChanges = (
  statuses: TicketStatusDefinition[],
  drafts: StatusOptionEditorItem[],
  deletedIds: Set<string>,
) => {
  if (deletedIds.size > 0) return true;

  return drafts.some((draft) => {
    if (draft.isNew) return true;
    const original = findOriginalStatus(statuses, draft);
    if (!original) return true;
    return statusNeedsUpdate(original, draft) || draft.sortOrder !== original.sortOrder;
  });
};

const executeCommand = async (host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<TicketStatusCommandResponse>("commands.execute", { commandId, params });
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? "Ticket status command failed.");
  }
  return response.outcome.value;
};

const readStatuses = async (host: GuestHost) => {
  const value = await executeCommand(host, commandIds.read);
  return (value as TicketStatusReadModel).statuses ?? [];
};

const saveTicketStatusDraft = async (
  host: GuestHost,
  statuses: TicketStatusDefinition[],
  draft: StatusOptionEditorItem,
) => {
  if (draft.isNew) {
    const created = (await executeCommand(host, commandIds.create, {
      label: draft.name,
      color: draft.color,
    })) as TicketStatusDefinition;
    return created.id;
  }

  const original = findOriginalStatus(statuses, draft);
  if (original && statusNeedsUpdate(original, draft)) {
    await executeCommand(host, commandIds.update, { statusId: draft.id, label: draft.name, color: draft.color });
  }
  return draft.id;
};

const saveTicketStatusDefinitions = async (input: SaveTicketStatusDefinitionsInput) => {
  const { deletedIds, drafts, host, statuses } = input;
  for (const statusId of deletedIds) {
    await executeCommand(host, commandIds.delete, { statusId });
  }

  const statusIdsInOrder: string[] = [];
  for (const draft of drafts) {
    statusIdsInOrder.push(await saveTicketStatusDraft(host, statuses, draft));
  }

  await executeCommand(host, commandIds.reorder, { statusIds: statusIdsInOrder });
};

const loadTicketStatuses = async (input: LoadTicketStatusesInput) => {
  const { host, isCancelled, setDrafts, setError, setLoading, setStatuses } = input;
  setLoading(true);
  setError(null);
  try {
    const nextStatuses = await readStatuses(host);
    if (!isCancelled?.()) {
      setStatuses(nextStatuses);
      setDrafts(toEditorItems(nextStatuses));
    }
  } catch (caught) {
    if (!isCancelled?.()) setError(caught instanceof Error ? caught.message : String(caught));
  } finally {
    if (!isCancelled?.()) setLoading(false);
  }
};

interface TicketStatusSettingsPanelProps {
  host: GuestHost;
}

const TicketStatusSettingsPanel = (props: TicketStatusSettingsPanelProps) => {
  const { host } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<TicketStatusDefinition[]>([]);
  const [drafts, setDrafts] = useState<StatusOptionEditorItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const hasChanges = hasStatusDefinitionChanges(statuses, drafts, deletedIds);

  const refresh = () => loadTicketStatuses({ host, setDrafts, setError, setLoading, setStatuses });

  useEffect(() => {
    let cancelled = false;
    void loadTicketStatuses({
      host,
      isCancelled: () => cancelled,
      setDrafts,
      setError,
      setLoading,
      setStatuses,
    });
    return () => {
      cancelled = true;
    };
  }, [host]);

  const handleDeleteStatus = (status: StatusOptionEditorItem) => {
    if (!status.isNew) setDeletedIds(new Set([...deletedIds, status.id]));
    setDrafts(drafts.filter((draft) => draft.id !== status.id));
  };

  const handleCancel = () => {
    setDrafts(toEditorItems(statuses));
    setDeletedIds(new Set());
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveTicketStatusDefinitions({ deletedIds, drafts, host, statuses });
      setDeletedIds(new Set());
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack boxSizing="border-box" minH="100%" p="lg" gap="lg" bg="bg" color="fg">
      {error ? (
        <AlertMessage status="error" colorPalette="red" title="Unable to update ticket statuses" size="sm">
          {error}
        </AlertMessage>
      ) : null}
      {loading ? (
        <HStack gap="sm" color="fg.muted">
          <Spinner size="sm" />
          <Text textStyle="paragraph/S/regular">Loading...</Text>
        </HStack>
      ) : (
        <StatusOptionEditor
          title="Ticket statuses"
          description="Configure the board columns used by tickets."
          items={drafts}
          onItemsChange={setDrafts}
          onDeleteItem={handleDeleteStatus}
          hasChanges={hasChanges}
          isSaving={saving}
          showIcons={false}
          addLabel="Add status"
          addPlaceholder="Status label"
          deleteHeadline="Delete ticket status?"
          deleteNotificationText={(status) => `This will delete the "${status.name}" column from the ticket board.`}
          deleteButtonText="Delete status"
          onSave={handleSave}
          onCancel={handleCancel}
        />
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
          <TicketStatusSettingsPanel host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
