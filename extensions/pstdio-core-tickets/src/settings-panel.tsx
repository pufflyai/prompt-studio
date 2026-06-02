import "@pstdio/ui/style.css";

import {
  type CommandResponse,
  defineExtensionView,
  type GuestHost,
  unwrapCommandOutcome,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, type SaveTagSettingsInput, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

interface TicketStatusDefinition {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

interface TicketStatusReadModel {
  statuses: TicketStatusDefinition[];
}

interface TicketStatusSettingsPanelProps {
  host: GuestHost;
}

const commandIds = {
  create: "pstdio-core-tickets.ticketStatus.create",
  delete: "pstdio-core-tickets.ticketStatus.delete",
  read: "pstdio-core-tickets.ticketStatus.read",
  reorder: "pstdio-core-tickets.ticketStatus.reorder",
  update: "pstdio-core-tickets.ticketStatus.update",
};

const toEditorValue = (status: TicketStatusDefinition): TagEditorValue => ({
  id: status.id,
  name: status.name,
  color: status.color,
  sortOrder: status.sortOrder,
});

const statusNeedsUpdate = (original: TicketStatusDefinition, draft: TagEditorValue) =>
  draft.name !== original.name || draft.color !== original.color;

const executeCommand = async <TResult,>(host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<CommandResponse<TResult>>("commands.execute", { commandId, params });
  return unwrapCommandOutcome(response, "Ticket status command failed.");
};

const readStatuses = async (host: GuestHost) => {
  const value = await executeCommand<TicketStatusReadModel>(host, commandIds.read);
  return value.statuses ?? [];
};

const saveTicketStatusDraft = async (host: GuestHost, statuses: TicketStatusDefinition[], draft: TagEditorValue) => {
  if (draft.isNew) {
    const created = await executeCommand<TicketStatusDefinition>(host, commandIds.create, {
      label: draft.name,
      color: draft.color,
    });
    return created.id;
  }

  const original = statuses.find((status) => status.id === draft.id);
  if (original && statusNeedsUpdate(original, draft)) {
    await executeCommand(host, commandIds.update, { statusId: draft.id, label: draft.name, color: draft.color });
  }
  return draft.id;
};

const saveTicketStatusDefinitions = async (host: GuestHost, input: SaveTagSettingsInput<TicketStatusDefinition>) => {
  const { deletedIds, drafts, values: statuses } = input;
  for (const statusId of deletedIds) {
    await executeCommand(host, commandIds.delete, { statusId });
  }

  const statusIdsInOrder: string[] = [];
  for (const draft of drafts) {
    statusIdsInOrder.push(await saveTicketStatusDraft(host, statuses, draft));
  }

  await executeCommand(host, commandIds.reorder, { statusIds: statusIdsInOrder });
};

const TicketStatusSettingsPanel = (props: TicketStatusSettingsPanelProps) => {
  const { host } = props;

  return (
    <TagSettingsPanel
      source={host}
      readValues={readStatuses}
      saveValues={saveTicketStatusDefinitions}
      toEditorValue={toEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      errorTitle="Unable to update ticket statuses"
      title="Ticket statuses"
      description="Configure the board columns used by tickets."
      showIcons={false}
      addLabel="Add status"
      addPlaceholder="Status label"
      deleteHeadline="Delete ticket status?"
      deleteNotificationText={(status) => `This will delete the "${status.name}" column from the ticket board.`}
      deleteButtonText="Delete status"
    />
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
