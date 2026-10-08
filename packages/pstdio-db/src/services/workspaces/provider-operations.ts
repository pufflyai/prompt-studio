import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  type WorkspaceCapabilities,
  type WorkspaceProviderError,
  type WorkspaceProviderRef,
  type WorkspaceProviderState,
  workspaces,
} from "../../db/schemas.pg";
import { workspaceColumns } from "../legacy-resource-links";
import { nowTimestamp } from "./workspace-record";

export interface ProviderProjectionInput {
  provider_params_json?: Record<string, unknown>;
  branch?: string | null;
  root_path?: string | null;
  provider_ref_json?: WorkspaceProviderRef | null;
  provider_state?: WorkspaceProviderState;
  execution_kind?: "local" | "remote";
  provider_operation_id?: string | null;
  provider_operation_kind?: "create" | "cancel" | "archive" | "delete" | null;
  provider_error_json?: WorkspaceProviderError | null;
  provider_capabilities_json?: WorkspaceCapabilities;
  display_path?: string | null;
}

const providerProjectionValues = (input: ProviderProjectionInput) => ({
  ...(Object.hasOwn(input, "provider_params_json") ? { provider_params_json: input.provider_params_json } : {}),
  ...(Object.hasOwn(input, "branch") ? { branch: input.branch } : {}),
  ...(Object.hasOwn(input, "root_path") ? { root_path: input.root_path } : {}),
  ...(Object.hasOwn(input, "provider_ref_json") ? { provider_ref_json: input.provider_ref_json } : {}),
  provider_state: input.provider_state,
  execution_kind: input.execution_kind,
  ...(Object.hasOwn(input, "provider_operation_id") ? { provider_operation_id: input.provider_operation_id } : {}),
  ...(Object.hasOwn(input, "provider_operation_kind")
    ? { provider_operation_kind: input.provider_operation_kind }
    : {}),
  ...(Object.hasOwn(input, "provider_error_json") ? { provider_error_json: input.provider_error_json } : {}),
  provider_capabilities_json: input.provider_capabilities_json,
  ...(Object.hasOwn(input, "display_path") ? { display_path: input.display_path } : {}),
  updated_at: nowTimestamp(),
});

export const updateProviderProjection = async (db: DbClient, id: string, input: ProviderProjectionInput) => {
  const [updated] = await db
    .update(workspaces)
    .set(providerProjectionValues(input))
    .where(eq(workspaces.id, id))
    .returning(workspaceColumns);
  return updated ?? null;
};

export const updateProviderOperationProjection = async (
  db: DbClient,
  id: string,
  input: {
    operationId: string;
    operationKind: "create" | "cancel" | "archive" | "delete";
    patch: ProviderProjectionInput;
  },
) => {
  const [updated] = await db
    .update(workspaces)
    .set(providerProjectionValues(input.patch))
    .where(
      and(
        eq(workspaces.id, id),
        eq(workspaces.provider_operation_id, input.operationId),
        eq(workspaces.provider_operation_kind, input.operationKind),
      ),
    )
    .returning(workspaceColumns);
  return updated ?? null;
};

export const beginProviderOperation = async (
  db: DbClient,
  id: string,
  input: {
    operationId: string;
    kind: "cancel" | "archive" | "delete";
    state: "provisioning" | "archiving" | "deleting";
  },
) => {
  const [updated] = await db
    .update(workspaces)
    .set({
      provider_state: input.state,
      provider_operation_id: sql`case
        when ${workspaces.provider_operation_kind} = 'create' and ${workspaces.provider_ref_json} is not null
          then ${input.operationId}
        else coalesce(${workspaces.provider_operation_id}, ${input.operationId})
      end`,
      provider_operation_kind: input.kind,
      provider_error_json: null,
      updated_at: nowTimestamp(),
    })
    .where(
      and(
        eq(workspaces.id, id),
        or(
          isNull(workspaces.provider_operation_kind),
          eq(workspaces.provider_operation_kind, input.kind),
          eq(workspaces.provider_operation_kind, "create"),
        ),
      ),
    )
    .returning(workspaceColumns);
  if (updated) return updated;

  const [current] = await db.select(workspaceColumns).from(workspaces).where(eq(workspaces.id, id));
  return current ?? null;
};
