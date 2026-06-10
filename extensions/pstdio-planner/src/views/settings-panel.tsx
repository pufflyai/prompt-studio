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
  icon?: string | null;
  sortOrder: number;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

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
  t: (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
}

const commandIds = {
  create: "pstdio-planner.ticketStatus.create",
  delete: "pstdio-planner.ticketStatus.delete",
  read: "pstdio-planner.ticketStatus.read",
  reorder: "pstdio-planner.ticketStatus.reorder",
  update: "pstdio-planner.ticketStatus.update",
};

const toEditorValue = (status: TicketStatusDefinition): TagEditorValue => ({
  id: status.id,
  name: status.name,
  color: status.color,
  icon: status.icon ?? null,
  sortOrder: status.sortOrder,
  actions: statusToActions(status),
});

const statusNeedsUpdate = (original: TicketStatusDefinition, draft: TagEditorValue) =>
  draft.name !== original.name ||
  draft.color !== original.color ||
  (draft.icon ?? null) !== (original.icon ?? null) ||
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
      icon: draft.icon ?? null,
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
      icon: draft.icon ?? null,
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
  const { host, t } = props;
  const actionOptions = [
    { value: "create_ticket", label: t("settings.ticketStatuses.actions.createTicket", "Create ticket") },
    { value: "drag_in", label: t("settings.ticketStatuses.actions.dragIn", "Drag in") },
    { value: "drag_out", label: t("settings.ticketStatuses.actions.dragOut", "Drag out") },
    { value: "archive_all", label: t("boardView.archiveAll", "Archive all") },
  ];

  return (
    <TagSettingsPanel
      queryKey={["ticket-statuses"]}
      source={host}
      readValues={readStatuses}
      saveValues={saveTicketStatusDefinitions}
      toEditorValue={toEditorValue}
      valueNeedsUpdate={statusNeedsUpdate}
      errorTitle={t("settings.ticketStatuses.errorTitle", "Unable to update ticket statuses")}
      title={t("settings.ticketStatuses.title", "Ticket statuses")}
      description={t("settings.ticketStatuses.description", "Configure the board columns used by tickets.")}
      actionOptions={actionOptions}
      actionsColumnLabel={t("settings.ticketStatuses.actionsColumnLabel", "Actions")}
      addLabel={t("settings.ticketStatuses.addLabel", "Add status")}
      addPlaceholder={t("settings.ticketStatuses.addPlaceholder", "Status label")}
      deleteHeadline={t("settings.ticketStatuses.deleteHeadline", "Delete ticket status?")}
      deleteNotificationText={(status) =>
        t(
          "settings.ticketStatuses.deleteNotificationText",
          'This will delete the "{{name}}" column from the ticket board.',
          { name: status.name },
        )
      }
      deleteButtonText={t("settings.ticketStatuses.deleteButtonText", "Delete status")}
    />
  );
};

export default defineExtensionView({
  render({ mount, host, t }) {
    return renderTicketRoot(mount, <TicketStatusSettingsPanel host={host} t={t} />);
  },
});
