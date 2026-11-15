import { type SQL, sql } from "drizzle-orm";
import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";

/** Keep both link directions in SQL; neither workspace IDs nor their sessions enter an intermediate app list. */
const anchorCondition = (
  projectId: string,
  anchor: NonNullable<ExtensionSessionQuery["anchor"]>,
  workspaceIds: SQL,
  kind: string,
) => sql`exists (select 1 from resource_anchors related where related.project_id = ${projectId}
  ${anchor.projectId ? sql`and related.project_id = ${anchor.projectId}` : sql``}
  and ((related.source_owner = 'pstdio' and related.source_kind = ${kind} and related.source_id in (${workspaceIds})
    and related.target_kind = ${anchor.type} and related.target_id = ${anchor.id}
    ${anchor.extensionId ? sql`and related.target_owner = ${anchor.extensionId}` : sql``})
  or (related.target_owner = 'pstdio' and related.target_kind = ${kind} and related.target_id in (${workspaceIds})
    and related.source_kind = ${anchor.type} and related.source_id = ${anchor.id}
    ${anchor.extensionId ? sql`and related.source_owner = ${anchor.extensionId}` : sql``})))`;

export const workspaceAnchorCondition = (
  projectId: string,
  anchor: NonNullable<ExtensionSessionQuery["anchor"]>,
  workspaceIds: SQL,
) => anchorCondition(projectId, anchor, workspaceIds, "workspace");
export const sessionAnchorCondition = (
  projectId: string,
  anchor: NonNullable<ExtensionSessionQuery["anchor"]>,
  sessionId: SQL,
) => anchorCondition(projectId, anchor, sql`select ${sessionId}`, "session");
