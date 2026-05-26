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
  isDefault: boolean;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

interface TicketStatusReadModel {
  statuses: TicketStatusDefinition[];
}

interface TicketStatusSettingsPanelProps {
  host: GuestHost;
}

const commandIds = {
  create: "pstdio-core-ticket-automations.ticketStatus.create",
  delete: "pstdio-core-ticket-automations.ticketStatus.delete",
  read: "pstdio-core-ticket-automations.ticketStatus.read",
  reorder: "pstdio-core-ticket-automations.ticketStatus.reorder",
  setDefault: "pstdio-core-ticket-automations.ticketStatus.setDefault",
  update: "pstdio-core-ticket-automations.ticketStatus.update",
};

const actionOptions = [
  { value: "create_ticket", label: "Create ticket" },
  { value: "drag_in", label: "Drag in" },
  { value: "drag_out", label: "Drag out" },
  { value: "archive_all", label: "Archive all" },
];

const toActions = (status: TicketStatusDefinition) => [
  ...(status.canCreate ? ["create_ticket"] : []),
  ...(status.canDragIn ? ["drag_in"] : []),
  ...(status.canDragOut ? ["drag_out"] : []),
  ...(status.columnActions.includes("archive_all") ? ["archive_all"] : []),
];

const toPayload = (actions: string[] | undefined) => ({
  canCreate: actions?.includes("create_ticket") ?? false,
  canDragIn: actions?.includes("drag_in") ?? false,
  canDragOut: actions?.includes("drag_out") ?? false,
  columnActions: actions?.includes("archive_all") ? ["archive_all"] : [],
});

const toEditorItems = (statuses: TicketStatusDefinition[]): StatusOptionEditorItem[] =>
  statuses
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      sortOrder: status.sortOrder,
      isDefault: status.isDefault,
      actions: toActions(status),
    }));

const findOriginalStatus = (statuses: TicketStatusDefinition[], draft: StatusOptionEditorItem) =>
  statuses.find((status) => status.id === draft.id);

const statusNeedsUpdate = (original: TicketStatusDefinition, draft: StatusOptionEditorItem) => {
  const payload = toPayload(draft.actions);
  return (
    draft.name !== original.name ||
    draft.color !== original.color ||
    draft.sortOrder !== original.sortOrder ||
    payload.canCreate !== original.canCreate ||
    payload.canDragIn !== original.canDragIn ||
    payload.canDragOut !== original.canDragOut ||
    JSON.stringify(payload.columnActions) !== JSON.stringify(original.columnActions)
  );
};

const hasStatusChanges = (
  statuses: TicketStatusDefinition[],
  drafts: StatusOptionEditorItem[],
  deletedIds: Set<string>,
) => {
  if (deletedIds.size > 0) return true;
  return drafts.some((draft) => {
    if (draft.isNew) return true;
    const original = findOriginalStatus(statuses, draft);
    if (!original) return true;
    return statusNeedsUpdate(original, draft) || draft.isDefault !== original.isDefault;
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
  const payload = toPayload(draft.actions);
  if (draft.isNew) {
    const created = (await executeCommand(host, commandIds.create, {
      name: draft.name,
      color: draft.color,
      isDefault: draft.isDefault,
      ...payload,
    })) as TicketStatusDefinition;
    return created.id;
  }

  const original = findOriginalStatus(statuses, draft);
  if (original && statusNeedsUpdate(original, draft)) {
    await executeCommand(host, commandIds.update, {
      statusId: draft.id,
      name: draft.name,
      color: draft.color,
      ...payload,
    });
  }
  return draft.id;
};

const saveTicketStatusDefinitions = async (input: {
  deletedIds: Set<string>;
  drafts: StatusOptionEditorItem[];
  host: GuestHost;
  statuses: TicketStatusDefinition[];
}) => {
  const { deletedIds, drafts, host, statuses } = input;
  for (const statusId of deletedIds) {
    await executeCommand(host, commandIds.delete, { statusId });
  }

  const statusIdsInOrder: string[] = [];
  const originalDefault = statuses.find((status) => status.isDefault);
  let defaultStatusId = drafts.find((draft) => draft.isDefault)?.id ?? null;

  for (const draft of drafts) {
    const savedId = await saveTicketStatusDraft(host, statuses, draft);
    if (draft.id === defaultStatusId) defaultStatusId = savedId;
    statusIdsInOrder.push(savedId);
  }

  await executeCommand(host, commandIds.reorder, { statusIds: statusIdsInOrder });
  if (defaultStatusId && defaultStatusId !== originalDefault?.id) {
    await executeCommand(host, commandIds.setDefault, { statusId: defaultStatusId });
  }
};

const TicketStatusSettingsPanel = (props: TicketStatusSettingsPanelProps) => {
  const { host } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<TicketStatusDefinition[]>([]);
  const [drafts, setDrafts] = useState<StatusOptionEditorItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const hasChanges = hasStatusChanges(statuses, drafts, deletedIds);

  const refresh = async () => {
    const nextStatuses = await readStatuses(host);
    setStatuses(nextStatuses);
    setDrafts(toEditorItems(nextStatuses));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextStatuses = await readStatuses(host);
        if (!cancelled) {
          setStatuses(nextStatuses);
          setDrafts(toEditorItems(nextStatuses));
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
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
          description="Configure ticket status columns and board actions."
          items={drafts}
          actionOptions={actionOptions}
          onItemsChange={setDrafts}
          onDeleteItem={handleDeleteStatus}
          onSetDefault={(item) => setDrafts(drafts.map((draft) => ({ ...draft, isDefault: draft.id === item.id })))}
          hasChanges={hasChanges}
          isSaving={saving}
          showDefault
          showIcons={false}
          addLabel="Add status"
          addPlaceholder="Status name"
          deleteHeadline="Delete ticket status?"
          deleteNotificationText={(status) => `This will delete status "${status.name}" from ticket workflows.`}
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
