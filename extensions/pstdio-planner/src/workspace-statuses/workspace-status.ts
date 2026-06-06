import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

export interface WorkspaceStatusDefinition {
  id: string;
  label: string;
  color?: string;
  icon?: string | null;
  sortOrder: number;
}

export interface WorkspaceStatusValue {
  workspaceId: string;
  status?: string;
  updatedAt: string;
}

const statusDefinitionsCollection = "workspace-status-definitions";
const statusDefinitionsInitializedKey = "workspace-status-definitions-initialized";
const workspaceStatusValuesCollection = "workspace-status-values";

const defaultWorkspaceStatuses = [
  { id: "wip", label: "wip", color: "blue", icon: null, sortOrder: 10 },
  { id: "blocked", label: "blocked", color: "red", icon: null, sortOrder: 20 },
  { id: "review-ready", label: "review-ready", color: "amber", icon: null, sortOrder: 30 },
  { id: "reviewed", label: "reviewed", color: "green", icon: null, sortOrder: 40 },
  { id: "changes-requested", label: "changes-requested", color: "orange", icon: null, sortOrder: 50 },
] satisfies WorkspaceStatusDefinition[];

const bySortOrder = (left: WorkspaceStatusDefinition, right: WorkspaceStatusDefinition) =>
  left.sortOrder - right.sortOrder || left.label.localeCompare(right.label);

const normalizeId = (value: string) => value.trim().toLowerCase().replaceAll(/\s+/g, "-");

const definitions = (storage: ExtensionStorageApi) =>
  storage.collection<WorkspaceStatusDefinition>(statusDefinitionsCollection);

const workspaceValues = (storage: ExtensionStorageApi) =>
  storage.collection<WorkspaceStatusValue>(workspaceStatusValuesCollection);

export const ensureDefaultWorkspaceStatuses = async (storage: ExtensionStorageApi) => {
  const collection = definitions(storage);
  const existing = await collection.list();
  if (existing.length > 0) return existing.slice().sort(bySortOrder);
  if (await storage.get<boolean>(statusDefinitionsInitializedKey)) return [];

  for (const status of defaultWorkspaceStatuses) {
    await collection.put(status.id, status);
  }
  await storage.set(statusDefinitionsInitializedKey, true);

  return defaultWorkspaceStatuses.slice();
};

export const readWorkspaceStatusData = async (input: { storage: ExtensionStorageApi; workspaceIds?: string[] }) => {
  const statuses = await ensureDefaultWorkspaceStatuses(input.storage);
  const workspaceIdSet = new Set(input.workspaceIds ?? []);
  const valuesByWorkspaceId: Record<string, { status?: string; updatedAt: string }> = {};

  for (const value of await workspaceValues(input.storage).list()) {
    if (workspaceIdSet.size > 0 && !workspaceIdSet.has(value.workspaceId)) continue;
    valuesByWorkspaceId[value.workspaceId] = {
      ...(value.status ? { status: value.status } : {}),
      updatedAt: value.updatedAt,
    };
  }

  return {
    attribute: {
      id: "status",
      label: "Status",
      kind: "enum",
      filterable: true,
      groupable: true,
      displayable: true,
      sortable: true,
      editable: true,
    },
    statuses,
    valuesByWorkspaceId,
    defaultSettings: {
      viewMode: "board",
      columnGrouping: "status",
    },
  };
};

export const setWorkspaceStatusValue = async (input: {
  storage: ExtensionStorageApi;
  status: string;
  workspaceId: string;
}) => {
  await ensureDefaultWorkspaceStatuses(input.storage);
  const value = {
    workspaceId: input.workspaceId,
    status: input.status,
    updatedAt: new Date().toISOString(),
  } satisfies WorkspaceStatusValue;
  await workspaceValues(input.storage).put(input.workspaceId, value);
  return value;
};

export const createWorkspaceStatusDefinition = async (input: {
  color?: string;
  icon?: string | null;
  label: string;
  storage: ExtensionStorageApi;
}) => {
  const collection = definitions(input.storage);
  const statuses = await ensureDefaultWorkspaceStatuses(input.storage);
  const id = normalizeId(input.label);
  const sortOrder = Math.max(0, ...statuses.map((status) => status.sortOrder)) + 10;
  const status = { id, label: input.label, color: input.color, icon: input.icon ?? null, sortOrder };
  await collection.put(id, status);
  return status;
};

export const updateWorkspaceStatusDefinition = async (input: {
  color?: string;
  icon?: string | null;
  label?: string;
  statusId: string;
  storage: ExtensionStorageApi;
}) => {
  const collection = definitions(input.storage);
  const statuses = await ensureDefaultWorkspaceStatuses(input.storage);
  const current = statuses.find((status) => status.id === input.statusId);
  const next = {
    ...current,
    id: input.statusId,
    label: input.label ?? current?.label ?? input.statusId,
    color: input.color ?? current?.color,
    icon: input.icon === undefined ? (current?.icon ?? null) : input.icon,
    sortOrder: current?.sortOrder ?? statuses.length * 10 + 10,
  } satisfies WorkspaceStatusDefinition;
  await collection.put(input.statusId, next);
  return next;
};

export const deleteWorkspaceStatusDefinition = async (input: { statusId: string; storage: ExtensionStorageApi }) => {
  await ensureDefaultWorkspaceStatuses(input.storage);
  await definitions(input.storage).delete(input.statusId);

  for (const value of await workspaceValues(input.storage).list()) {
    if (value.status === input.statusId) await workspaceValues(input.storage).delete(value.workspaceId);
  }

  return { statusId: input.statusId };
};

export const reorderWorkspaceStatusDefinitions = async (input: {
  statusIds: string[];
  storage: ExtensionStorageApi;
}) => {
  const collection = definitions(input.storage);
  const statusesById = new Map(
    (await ensureDefaultWorkspaceStatuses(input.storage)).map((status) => [status.id, status]),
  );

  for (const [index, statusId] of input.statusIds.entries()) {
    const status = statusesById.get(statusId);
    if (!status) continue;
    await collection.put(statusId, { ...status, sortOrder: (index + 1) * 10 });
  }

  return readWorkspaceStatusData({ storage: input.storage, workspaceIds: [] });
};
