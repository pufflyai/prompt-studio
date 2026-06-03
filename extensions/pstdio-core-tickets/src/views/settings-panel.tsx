import {
  type CommandResponse,
  defineExtensionView,
  type GuestHost,
  unwrapCommandOutcome,
} from "@pstdio/sdk/extensions";
import { type SaveTagSettingsInput, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { renderTicketRoot } from "./view-root";

interface TicketStatusDefinition {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

const STATUS_ACTION_OPTIONS = [
  { value: "create_ticket", label: "Create ticket" },
  { value: "drag_in", label: "Drag in" },
  { value: "drag_out", label: "Drag out" },
  { value: "archive_all", label: "Archive all" },
];

// "archive_all" is a board column-header action; the create/drag entries map to
// the status' boolean capability flags. We flatten both into the generic editor
// action list and split them back apart on save.
const COLUMN_ACTION_VALUES = new Set(["archive_all"]);

const statusToActions = (status: TicketStatusDefinition) => [
  ...(status.canCreate ? ["create_ticket"] : []),
  ...(status.canDragIn ? ["drag_in"] : []),
  ...(status.canDragOut ? ["drag_out"] : []),
  ...(status.columnActions ?? []),
];

const actionsToFlags = (actions: string[] = []) => ({
  canCreate: actions.includes("create_ticket"),
  canDragIn: actions.includes("drag_in"),
  canDragOut: actions.includes("drag_out"),
  columnActions: actions.filter((action) => COLUMN_ACTION_VALUES.has(action)),
});

const sameActions = (left: string[], right: string[]) =>
  left.length === right.length && [...left].sort().join("|") === [...right].sort().join("|");

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
  actions: statusToActions(status),
});

const statusNeedsUpdate = (original: TicketStatusDefinition, draft: TagEditorValue) =>
  draft.name !== original.name ||
  draft.color !== original.color ||
  !sameActions(statusToActions(original), draft.actions ?? []);

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
      ...actionsToFlags(draft.actions),
    });
    return created.id;
  }

  const original = statuses.find((status) => status.id === draft.id);
  if (original && statusNeedsUpdate(original, draft)) {
    await executeCommand(host, commandIds.update, {
      statusId: draft.id,
      label: draft.name,
      color: draft.color,
      ...actionsToFlags(draft.actions),
    });
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
      queryKey={["ticket-statuses"]}
      source={host}
      readValues={readStatuses}
      saveValues={saveTicketStatusDefinitions}
      toEditorValue={toEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      errorTitle="Unable to update ticket statuses"
      title="Ticket statuses"
      description="Configure the board columns used by tickets."
      actionOptions={STATUS_ACTION_OPTIONS}
      actionsColumnLabel="Actions"
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
    return renderTicketRoot(mount, <TicketStatusSettingsPanel host={host} />);
  },
});
