import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  defaultLocalWorkspaceCapabilities,
  type ResourceRef,
  type WorkspaceCapabilities,
  type WorkspaceProviderError,
  type WorkspaceProviderRef,
  type WorkspaceProviderState,
  workspaces,
} from "../../db/schemas.pg";

export type WorkspaceRecord = typeof workspaces.$inferSelect;
export type JsonObject = Record<string, unknown>;

export type CreateInput = {
  project_id: string;
  shorthand_base: string;
  anchors?: ResourceRef[];
  name?: string;
  branch?: string;
  worktree_path?: string;
  provider_id?: string;
  provider_params_json?: JsonObject;
  provider_state?: WorkspaceProviderState;
  provider_operation_id?: string;
  provider_operation_kind?: "create" | "cancel" | "archive" | "delete";
};

export const nowTimestamp = () => new Date().toISOString();

const getAttemptNumber = (shorthandBase: string, workspaceShorthand: string) => {
  const prefix = `${shorthandBase}_A`;
  if (!workspaceShorthand.startsWith(prefix)) return null;
  const suffix = workspaceShorthand.slice(prefix.length);
  return /^\d+$/.test(suffix) ? Number(suffix) : null;
};

export const nextWorkspaceShorthand = (shorthandBase: string, existingShorthands: string[]) => {
  const maxAttempt = existingShorthands.reduce(
    (max, shorthand) => Math.max(max, getAttemptNumber(shorthandBase, shorthand) ?? 0),
    0,
  );
  return `${shorthandBase}_A${maxAttempt + 1}`;
};

export const standalonePrefix = "WS-";
const defaultShorthand = "default";

const getStandaloneNumber = (shorthand: string) => {
  if (!shorthand.startsWith(standalonePrefix)) return null;
  const suffix = shorthand.slice(standalonePrefix.length);
  return /^\d+$/.test(suffix) ? Number(suffix) : null;
};

export const nextStandaloneWorkspaceShorthand = (existingShorthands: string[]) => {
  const max = existingShorthands.reduce((value, shorthand) => Math.max(value, getStandaloneNumber(shorthand) ?? 0), 0);
  return `${standalonePrefix}${max + 1}`;
};

export const buildWorkspaceRecord = (input: {
  project_id: string;
  shorthand: string;
  name?: string;
  branch?: string;
  worktree_path?: string;
  is_default?: boolean;
  anchors?: ResourceRef[];
  provider_id?: string;
  provider_params_json?: JsonObject;
  provider_ref_json?: WorkspaceProviderRef | null;
  provider_state?: WorkspaceProviderState;
  execution_kind?: "local" | "remote";
  provider_operation_id?: string | null;
  provider_operation_kind?: "create" | "cancel" | "archive" | "delete" | null;
  provider_error_json?: WorkspaceProviderError | null;
  provider_capabilities_json?: WorkspaceCapabilities;
  display_path?: string | null;
}): WorkspaceRecord => {
  const timestamp = nowTimestamp();
  return {
    id: crypto.randomUUID(),
    project_id: input.project_id,
    name: input.name ?? input.shorthand,
    branch: input.branch ?? null,
    worktree_path: input.worktree_path ?? null,
    provider_id: input.provider_id ?? (input.is_default ? "pstdio.root" : "pstdio.worktree"),
    provider_params_json: input.provider_params_json ?? {},
    provider_ref_json: input.provider_ref_json ?? null,
    provider_state: input.provider_state ?? "ready",
    execution_kind: input.execution_kind ?? "local",
    provider_operation_id: input.provider_operation_id ?? null,
    provider_operation_kind: input.provider_operation_kind ?? null,
    provider_error_json: input.provider_error_json ?? null,
    provider_capabilities_json: input.provider_capabilities_json ?? defaultLocalWorkspaceCapabilities,
    display_path: input.display_path ?? input.worktree_path ?? null,
    is_default: input.is_default ?? false,
    archived: false,
    workspace_shorthand: input.shorthand,
    initializing: false,
    setup_error: null,
    startup_log_file_id: null,
    anchors_json: input.anchors ?? [],
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
};

export const insertDefaultWorkspace = async (
  db: DbClient,
  input: { project_id: string; name: string; branch: string | null },
) => {
  const record = buildWorkspaceRecord({
    project_id: input.project_id,
    shorthand: defaultShorthand,
    name: input.name,
    branch: input.branch ?? undefined,
    is_default: true,
  });
  await db.insert(workspaces).values(record);
  return record;
};

export const selectDefaultWorkspace = async (db: DbClient, projectId: string) => {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.project_id, projectId), eq(workspaces.is_default, true), sql`${workspaces.deleted_at} is null`),
    );
  return row ?? null;
};
