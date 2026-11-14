import { type SQL, sql } from "drizzle-orm";
import type { ResourceRef } from "pstdio-api-contracts/extension-kernel";
import type { StorageOwner } from "pstdio-sync";
import { legacyResourceOwner } from "../legacy-resource-links";
import { workspaceAnchorCondition } from "../sessions/workspace-anchor-query";

type Login = { accountId: string; deviceId: string };

export const personalAnchorCondition = (projectId: string, anchor: ResourceRef, value: SQL) => {
  let legacyOwner: string | undefined;
  try {
    legacyOwner = legacyResourceOwner({ type: anchor.type, id: anchor.id });
  } catch {
    /* New resource kinds require an explicit owner. */
  }
  const explicit = sql`coalesce(${value}->'anchors_json', '[]'::jsonb) @> ${JSON.stringify([
    { type: anchor.type, id: anchor.id, ...(anchor.extensionId ? { extensionId: anchor.extensionId } : {}) },
  ])}::jsonb`;
  const legacy =
    anchor.extensionId && anchor.extensionId === legacyOwner
      ? sql`exists (select 1 from jsonb_array_elements(coalesce(${value}->'anchors_json', '[]'::jsonb)) ref
      where ref->>'type' = ${anchor.type} and ref->>'id' = ${anchor.id} and coalesce(ref->>'extensionId', '') = '')`
      : sql`false`;
  return sql`(${anchor.projectId ? sql`${projectId} = ${anchor.projectId}` : sql`true`} and (${explicit} or ${legacy}))`;
};

/** Keep private workspace relations scoped to the signed-in account before selecting their sessions. */
export const personalWorkspaceSessionCondition = (
  owner: StorageOwner,
  login: Login,
  anchor: ResourceRef,
  sessionId: SQL,
) =>
  sql`${sessionId} in (select links.value->>'session_id' from storage_personal_history links
    where links.workbench_id = ${owner.workbenchId} and links.extension_id = ${owner.extensionId}
      and links.kind = 'workspace_sessions'
      and links.value->'device'->>'ownerId' = ${login.accountId}
      and links.value->'device'->>'id' <> ${login.deviceId}
      and links.value->>'workspace_id' in (
        select w.value->>'id' from storage_personal_history w
        where w.workbench_id = ${owner.workbenchId} and w.extension_id = ${owner.extensionId} and w.kind = 'workspaces'
          and w.value->'device'->>'ownerId' = ${login.accountId}
          and w.value->'device'->>'id' <> ${login.deviceId}
          and w.value->>'project_id' = ${owner.workbenchId}
          and coalesce(w.value->>'archived', 'false') = 'false' and w.value->>'deleted_at' is null
          and (${personalAnchorCondition(owner.workbenchId, anchor, sql`w.value`)}
            or ${workspaceAnchorCondition(owner.workbenchId, anchor, sql`select w.value->>'id'`)})
        union
        select w.id from workspaces w where w.project_id = ${owner.workbenchId}
          and w.archived = false and w.deleted_at is null
          and ${workspaceAnchorCondition(owner.workbenchId, anchor, sql`select w.id`)}
      ))`;
