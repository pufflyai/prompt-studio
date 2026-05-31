import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { executeExtensionCommand } from "@/shared/extensions/api";

export const workspaceStatusExtensionCommandIds = {
  read: "pstdio-core-workspace-automations.workspaceStatus.read",
  set: "pstdio-core-workspace-automations.workspaceStatus.set",
} as const;

export interface WorkspaceStatusDefinition {
  id: string;
  label: string;
  color?: string;
  icon?: string | null;
  sortOrder: number;
}

export interface WorkspaceStatusReadModel {
  attribute: {
    id: "status";
    label: string;
    kind: "enum";
    filterable: boolean;
    groupable: boolean;
    displayable: boolean;
    sortable: boolean;
    editable: boolean;
  };
  statuses: WorkspaceStatusDefinition[];
  valuesByWorkspaceId: Record<string, { status?: string; updatedAt: string }>;
  defaultSettings?: {
    viewMode?: "board" | "list";
    columnGrouping?: string;
  };
}

type ExecuteWorkspaceStatusCommand = (
  projectId: string,
  commandId: string,
  body: unknown,
) => Promise<CommandExecuteResponse>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCommandNotFound = (error: unknown) =>
  isRecord(error) &&
  (error.status === 404 ||
    (isRecord(error.response) && error.response.status === 404) ||
    String(error.message ?? "").includes("command_not_found"));

export const isWorkspaceStatusReadModel = (value: unknown): value is WorkspaceStatusReadModel => {
  if (!isRecord(value) || !Array.isArray(value.statuses) || !isRecord(value.valuesByWorkspaceId)) return false;
  if (!isRecord(value.attribute) || value.attribute.id !== "status" || value.attribute.kind !== "enum") return false;

  return value.statuses.every(
    (status) => isRecord(status) && typeof status.id === "string" && typeof status.label === "string",
  );
};

const readCommandValue = (response: CommandExecuteResponse) => {
  if (response.outcome.status !== "success") throw new Error(response.outcome.reason ?? "Extension command failed.");
  return response.outcome.value;
};

export const readWorkspaceStatusExtensionData = async (
  projectId: string | undefined,
  workspaceIds: string[],
  executeCommand: ExecuteWorkspaceStatusCommand = executeExtensionCommand,
) => {
  if (!projectId) return null;

  try {
    const response = await executeCommand(projectId, workspaceStatusExtensionCommandIds.read, {
      params: { workspaceIds },
      source: "dashboard",
    });
    const value = readCommandValue(response);
    return isWorkspaceStatusReadModel(value) ? value : null;
  } catch (error) {
    if (isCommandNotFound(error)) return null;
    throw error;
  }
};

export const setWorkspaceStatusExtensionValue = async (
  projectId: string | undefined,
  workspaceId: string,
  status: string,
  executeCommand: ExecuteWorkspaceStatusCommand = executeExtensionCommand,
) => {
  if (!projectId) return null;

  const response = await executeCommand(projectId, workspaceStatusExtensionCommandIds.set, {
    params: { workspaceId, status },
    source: "dashboard",
  });
  return readCommandValue(response);
};
