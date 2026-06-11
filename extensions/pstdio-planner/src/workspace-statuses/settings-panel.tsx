import "@pstdio/ui/style.css";

import {
  type CommandResponse,
  defineExtensionView,
  type GuestHost,
  unwrapCommandOutcome,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, type SaveTagSettingsInput, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

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
  t: (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
}

const commandIds = {
  create: "pstdio-planner.workspaceStatus.create",
  delete: "pstdio-planner.workspaceStatus.delete",
  read: "pstdio-planner.workspaceStatus.read",
  reorder: "pstdio-planner.workspaceStatus.reorder",
  update: "pstdio-planner.workspaceStatus.update",
};

const WORKSPACE_STATUS_QUERY_KEY = ["workspace-statuses"] as const;

const toEditorValue = (status: WorkspaceStatusDefinition): TagEditorValue => ({
  id: status.id,
  name: status.label,
  color: status.color ?? "gray",
  icon: status.icon ?? null,
  sortOrder: status.sortOrder,
});

const statusNeedsUpdate = (original: WorkspaceStatusDefinition, draft: TagEditorValue) =>
  draft.name !== original.label ||
  draft.color !== (original.color ?? "gray") ||
  (draft.icon ?? null) !== (original.icon ?? null);

const executeCommand = async <TResult,>(host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<CommandResponse<TResult>>("commands.execute", { commandId, params });
  return unwrapCommandOutcome(response, "Workspace status command failed.");
};

const readStatuses = async (host: GuestHost) => {
  const value = await executeCommand<WorkspaceStatusReadModel>(host, commandIds.read, { workspaceIds: [] });
  return value.statuses ?? [];
};

const saveWorkspaceStatusDraft = async (
  host: GuestHost,
  statuses: WorkspaceStatusDefinition[],
  draft: TagEditorValue,
) => {
  if (draft.isNew) {
    const created = await executeCommand<WorkspaceStatusDefinition>(host, commandIds.create, {
      label: draft.name,
      color: draft.color,
      icon: draft.icon ?? null,
    });
    return created.id;
  }

  const original = statuses.find((status) => status.id === draft.id);
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

const saveWorkspaceStatusDefinitions = async (
  host: GuestHost,
  input: SaveTagSettingsInput<WorkspaceStatusDefinition>,
) => {
  const { deletedIds, drafts, values: statuses } = input;
  for (const statusId of deletedIds) {
    await executeCommand(host, commandIds.delete, { statusId });
  }

  const statusIdsInOrder: string[] = [];
  for (const draft of drafts) {
    statusIdsInOrder.push(await saveWorkspaceStatusDraft(host, statuses, draft));
  }

  await executeCommand(host, commandIds.reorder, { statusIds: statusIdsInOrder });
};

const WorkspaceStatusSettingsPanel = (props: WorkspaceStatusSettingsPanelProps) => {
  const { host, t } = props;
  const queryClient = useQueryClient();
  const statusesQuery = useQuery({
    queryKey: WORKSPACE_STATUS_QUERY_KEY,
    queryFn: () => readStatuses(host),
    staleTime: Infinity,
  });
  const saveStatuses = useMutation({
    mutationFn: (input: SaveTagSettingsInput<WorkspaceStatusDefinition>) => saveWorkspaceStatusDefinitions(host, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKSPACE_STATUS_QUERY_KEY }),
  });

  return (
    <TagSettingsPanel
      values={statusesQuery.data as WorkspaceStatusDefinition[] | undefined}
      loadError={statusesQuery.error}
      onSave={(input: SaveTagSettingsInput<WorkspaceStatusDefinition>) => saveStatuses.mutateAsync(input)}
      toEditorValue={toEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      errorTitle={t("settings.workspaceStatuses.errorTitle", "Unable to update workspace statuses")}
      title={t("settings.workspaceStatuses.title", "Workspace statuses")}
      description={t(
        "settings.workspaceStatuses.description",
        "Configure the status values used by workspace automations.",
      )}
      addLabel={t("settings.workspaceStatuses.addLabel", "Add status")}
      addPlaceholder={t("settings.workspaceStatuses.addPlaceholder", "Status label")}
      deleteHeadline={t("settings.workspaceStatuses.deleteHeadline", "Delete workspace status?")}
      deleteNotificationText={(status) =>
        t(
          "settings.workspaceStatuses.deleteNotificationText",
          'This will delete status "{{name}}" from workspace automations.',
          { name: status.name },
        )
      }
      deleteButtonText={t("settings.workspaceStatuses.deleteButtonText", "Delete status")}
    />
  );
};

export default defineExtensionView({
  render({ mount, host, t }) {
    const queryClient = new QueryClient();
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ChakraProvider value={psTheme}>
            <WorkspaceStatusSettingsPanel host={host} t={t} />
          </ChakraProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
