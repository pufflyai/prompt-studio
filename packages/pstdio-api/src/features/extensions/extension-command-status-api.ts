import type { ExtensionsRouteDeps } from "./deps";

const parseColumnActions = (value: string) => JSON.parse(value) as string[];

const toTicketStatus = (row: {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  can_create: boolean;
  can_drag_in: boolean;
  can_drag_out: boolean;
  column_actions: string;
}) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sort_order,
  isDefault: row.is_default,
  canCreate: row.can_create,
  canDragIn: row.can_drag_in,
  canDragOut: row.can_drag_out,
  columnActions: parseColumnActions(row.column_actions),
});

const toAttemptStatus = (row: {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
}) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sort_order,
  isDefault: row.is_default,
});

const ticketStatusUpdatePayload = (input: {
  name?: string;
  color?: string;
  sortOrder?: number;
  canCreate?: boolean;
  canDragIn?: boolean;
  canDragOut?: boolean;
  columnActions?: string[];
}) => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.color !== undefined ? { color: input.color } : {}),
  ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
  ...(input.canCreate !== undefined ? { can_create: input.canCreate } : {}),
  ...(input.canDragIn !== undefined ? { can_drag_in: input.canDragIn } : {}),
  ...(input.canDragOut !== undefined ? { can_drag_out: input.canDragOut } : {}),
  ...(input.columnActions !== undefined ? { column_actions: input.columnActions } : {}),
});

const getTicketStatus = async (deps: ExtensionsRouteDeps, projectId: string, statusId: string) =>
  (await deps.statusService.list(projectId)).find((status) => status.id === statusId)!;

/** @deprecated Legacy core ticket status extension context API. Ticket statuses are owned by the pstdio tickets extension. */
export const createTicketStatusesApi = (deps: ExtensionsRouteDeps, projectId: string) => ({
  async list() {
    return (await deps.statusService.list(projectId)).map(toTicketStatus);
  },
  async create(input: {
    name: string;
    color: string;
    sortOrder?: number;
    isDefault?: boolean;
    canCreate?: boolean;
    canDragIn?: boolean;
    canDragOut?: boolean;
    columnActions?: string[];
  }) {
    const created = await deps.statusService.create({
      project_id: projectId,
      name: input.name,
      color: input.color,
      is_default: input.isDefault,
    });
    const patch = ticketStatusUpdatePayload(input);
    if (Object.keys(patch).length > 0) await deps.statusService.update(created.id, patch);
    const row = await getTicketStatus(deps, projectId, created.id);
    deps.eventBus.emit("ticket_statuses", "set", row);
    return toTicketStatus(row);
  },
  async update(input: {
    statusId: string;
    name?: string;
    color?: string;
    sortOrder?: number;
    canCreate?: boolean;
    canDragIn?: boolean;
    canDragOut?: boolean;
    columnActions?: string[];
  }) {
    await deps.statusService.update(input.statusId, ticketStatusUpdatePayload(input));
    const row = await getTicketStatus(deps, projectId, input.statusId);
    deps.eventBus.emit("ticket_statuses", "set", row);
    return toTicketStatus(row);
  },
  async setDefault(input: { statusId: string }) {
    await deps.statusService.setDefault(projectId, input.statusId);
    deps.eventBus.emit("ticket_statuses", "set", await getTicketStatus(deps, projectId, input.statusId));
  },
  async delete(input: { statusId: string }) {
    await deps.statusService.remove(input.statusId);
    deps.eventBus.emit("ticket_statuses", "delete", { id: input.statusId });
  },
});

const getAttemptStatus = async (deps: ExtensionsRouteDeps, projectId: string, statusId: string) =>
  (await deps.attemptStatusService.list(projectId)).find((status) => status.id === statusId)!;

export const createAttemptStatusesApi = (deps: ExtensionsRouteDeps, projectId: string) => ({
  async list() {
    return (await deps.attemptStatusService.list(projectId)).map(toAttemptStatus);
  },
  async create(input: { name: string; color: string; sortOrder?: number; isDefault?: boolean }) {
    const created = await deps.attemptStatusService.create({
      project_id: projectId,
      name: input.name,
      color: input.color,
      is_default: input.isDefault,
    });
    if (input.sortOrder !== undefined) {
      await deps.attemptStatusService.update(created.id, { sort_order: input.sortOrder });
    }
    const row = await getAttemptStatus(deps, projectId, created.id);
    deps.eventBus.emit("attempt_statuses", "set", row);
    return toAttemptStatus(row);
  },
  async update(input: { statusId: string; name?: string; color?: string; sortOrder?: number; isDefault?: boolean }) {
    await deps.attemptStatusService.update(input.statusId, {
      name: input.name,
      color: input.color,
      sort_order: input.sortOrder,
      is_default: input.isDefault,
    });
    const row = await getAttemptStatus(deps, projectId, input.statusId);
    deps.eventBus.emit("attempt_statuses", "set", row);
    return toAttemptStatus(row);
  },
  async delete(input: { statusId: string }) {
    await deps.attemptStatusService.remove(input.statusId);
    deps.eventBus.emit("attempt_statuses", "delete", { id: input.statusId });
  },
});
