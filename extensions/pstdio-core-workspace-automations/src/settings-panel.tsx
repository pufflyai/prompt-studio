import "@pstdio/ui/style.css";

import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme, StatusOptionEditor, type StatusOptionEditorItem } from "@pstdio/ui";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface WorkspaceStatusCommandResponse {
  outcome: {
    ok: boolean;
    reason?: string;
    status: "success" | "rejected" | "error";
    value?: unknown;
  };
}

interface WorkspaceStatusDefinition {
  id: string;
  label: string;
  color?: string;
  icon?: string | null;
  sortOrder: number;
}

interface WorkspaceStatusReadModel {
  statuses: WorkspaceStatusDefinition[];
}

interface WorkspaceStatusSettingsPanelProps {
  host: GuestHost;
}

interface LoadWorkspaceStatusesInput {
  host: GuestHost;
  isCancelled?: () => boolean;
  setDrafts: (statuses: StatusOptionEditorItem[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setStatuses: (statuses: WorkspaceStatusDefinition[]) => void;
}

interface SaveWorkspaceStatusDefinitionsInput {
  deletedIds: Set<string>;
  drafts: StatusOptionEditorItem[];
  host: GuestHost;
  statuses: WorkspaceStatusDefinition[];
}

const commandIds = {
  create: "pstdio-core-workspace-automations.workspaceStatus.create",
  delete: "pstdio-core-workspace-automations.workspaceStatus.delete",
  read: "pstdio-core-workspace-automations.workspaceStatus.read",
  reorder: "pstdio-core-workspace-automations.workspaceStatus.reorder",
  update: "pstdio-core-workspace-automations.workspaceStatus.update",
};

const bySortOrder = (left: WorkspaceStatusDefinition, right: WorkspaceStatusDefinition) =>
  left.sortOrder - right.sortOrder || left.label.localeCompare(right.label);

const toEditorItems = (statuses: WorkspaceStatusDefinition[]): StatusOptionEditorItem[] =>
  statuses
    .slice()
    .sort(bySortOrder)
    .map((status) => ({
      id: status.id,
      name: status.label,
      color: status.color ?? "gray",
      icon: status.icon ?? null,
      sortOrder: status.sortOrder,
    }));

const findOriginalStatus = (statuses: WorkspaceStatusDefinition[], draft: StatusOptionEditorItem) =>
  statuses.find((status) => status.id === draft.id);

const statusNeedsUpdate = (original: WorkspaceStatusDefinition, draft: StatusOptionEditorItem) =>
  draft.name !== original.label ||
  draft.color !== (original.color ?? "gray") ||
  (draft.icon ?? null) !== (original.icon ?? null);

const hasStatusDefinitionChanges = (
  statuses: WorkspaceStatusDefinition[],
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
  const response = await host.call<WorkspaceStatusCommandResponse>("commands.execute", { commandId, params });
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? "Workspace status command failed.");
  }
  return response.outcome.value;
};

const readStatuses = async (host: GuestHost) => {
  const value = await executeCommand(host, commandIds.read, { workspaceIds: [] });
  return (value as WorkspaceStatusReadModel).statuses ?? [];
};

const saveWorkspaceStatusDraft = async (
  host: GuestHost,
  statuses: WorkspaceStatusDefinition[],
  draft: StatusOptionEditorItem,
) => {
  if (draft.isNew) {
    const created = (await executeCommand(host, commandIds.create, {
      label: draft.name,
      color: draft.color,
      icon: draft.icon ?? null,
    })) as WorkspaceStatusDefinition;
    return created.id;
  }

  const original = findOriginalStatus(statuses, draft);
  if (original && statusNeedsUpdate(original, draft)) {
    await executeCommand(host, commandIds.update, {
      statusId: draft.id,
      label: draft.name,
      color: draft.color,
      icon: draft.icon ?? null,
    });
  }
  return draft.id;
};

const saveWorkspaceStatusDefinitions = async (input: SaveWorkspaceStatusDefinitionsInput) => {
  const { deletedIds, drafts, host, statuses } = input;
  for (const statusId of deletedIds) {
    await executeCommand(host, commandIds.delete, { statusId });
  }

  const statusIdsInOrder: string[] = [];
  for (const draft of drafts) {
    statusIdsInOrder.push(await saveWorkspaceStatusDraft(host, statuses, draft));
  }

  await executeCommand(host, commandIds.reorder, { statusIds: statusIdsInOrder });
};

const loadWorkspaceStatuses = async (input: LoadWorkspaceStatusesInput) => {
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

const WorkspaceStatusSettingsPanel = (props: WorkspaceStatusSettingsPanelProps) => {
  const { host } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<WorkspaceStatusDefinition[]>([]);
  const [drafts, setDrafts] = useState<StatusOptionEditorItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const hasChanges = hasStatusDefinitionChanges(statuses, drafts, deletedIds);

  const refresh = () => loadWorkspaceStatuses({ host, setDrafts, setError, setLoading, setStatuses });

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceStatuses({
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
      await saveWorkspaceStatusDefinitions({ deletedIds, drafts, host, statuses });
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
        <AlertMessage status="error" colorPalette="red" title="Unable to update workspace statuses" size="sm">
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
          title="Workspace statuses"
          description="Configure the status values used by workspace automations."
          items={drafts}
          onItemsChange={setDrafts}
          onDeleteItem={handleDeleteStatus}
          hasChanges={hasChanges}
          isSaving={saving}
          addLabel="Add status"
          addPlaceholder="Status label"
          deleteHeadline="Delete workspace status?"
          deleteNotificationText={(status) => `This will delete status "${status.name}" from workspace automations.`}
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
          <WorkspaceStatusSettingsPanel host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
