import "@pstdio/ui/style.css";

import {
  type CommandResponse,
  defineExtensionView,
  type GuestHost,
  unwrapCommandOutcome,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, type SaveTagSettingsInput, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
}

const commandIds = {
  create: "pstdio-planner.workspaceStatus.create",
  delete: "pstdio-planner.workspaceStatus.delete",
  read: "pstdio-planner.workspaceStatus.read",
  reorder: "pstdio-planner.workspaceStatus.reorder",
  update: "pstdio-planner.workspaceStatus.update",
};

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
  const { host } = props;

  return (
    <TagSettingsPanel
      queryKey={["workspace-statuses"]}
      source={host}
      readValues={readStatuses}
      saveValues={saveWorkspaceStatusDefinitions}
      toEditorValue={toEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      errorTitle="Unable to update workspace statuses"
      title="Workspace statuses"
      description="Configure the status values used by workspace automations."
      addLabel="Add status"
      addPlaceholder="Status label"
      deleteHeadline="Delete workspace status?"
      deleteNotificationText={(status) => `This will delete status "${status.name}" from workspace automations.`}
      deleteButtonText="Delete status"
    />
  );
};

export default defineExtensionView({
  render({ mount, host }) {
    const queryClient = new QueryClient();
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ChakraProvider value={psTheme}>
            <WorkspaceStatusSettingsPanel host={host} />
          </ChakraProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
