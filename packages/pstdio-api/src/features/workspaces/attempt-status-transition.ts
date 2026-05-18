import { randomUUID } from "node:crypto";
import { buildDiff, emitActivityEvent } from "../activity/activity-events";
import type { WorkspacesRouteDeps } from "./deps";

type Deps = Pick<WorkspacesRouteDeps, "activityEventsService" | "attemptStatusService" | "workspaceService">;

export type SetWorkspaceAttemptStatusInput = {
  workspaceId: string;
  status: string;
  sessionId?: string;
};

export const setWorkspaceAttemptStatus = async (deps: Deps, input: SetWorkspaceAttemptStatusInput) => {
  const workspace = await deps.workspaceService.get(input.workspaceId);
  if (!workspace) throw new Error(`Workspace not found: ${input.workspaceId}`);

  const toStatus = await deps.attemptStatusService.getByName(workspace.project_id, input.status);
  if (!toStatus) throw new Error(`Attempt status not found: "${input.status}"`);

  const fromStatus = workspace.attempt_status_id
    ? await deps.attemptStatusService.get(workspace.attempt_status_id)
    : null;
  const fromStatusName = fromStatus?.name ?? null;
  const statusChangeId = randomUUID();

  if (fromStatusName === input.status) {
    return {
      changed: false,
      workspace,
      result: {
        id: workspace.id,
        attempt_status_id: workspace.attempt_status_id,
        from_status: fromStatusName,
        to_status: input.status,
        status_change_id: statusChangeId,
      },
    };
  }

  const updated = await deps.workspaceService.updateAttemptStatus(input.workspaceId, toStatus.id);
  if (!updated) throw new Error(`Workspace not found: ${input.workspaceId}`);

  await emitActivityEvent(deps, {
    projectId: updated.project_id,
    resourceType: "workspace",
    resourceId: updated.id,
    eventType: "workspace_attempt_status_updated",
    summary: `Updated attempt status for ${updated.workspace_shorthand}`,
    payload: {
      status: buildDiff(fromStatusName, input.status),
      to_status: input.status,
      session_id: input.sessionId ?? null,
      status_change_id: statusChangeId,
    },
  });

  return {
    changed: true,
    workspace: updated,
    result: {
      id: updated.id,
      attempt_status_id: updated.attempt_status_id,
      from_status: fromStatusName,
      to_status: input.status,
      status_change_id: statusChangeId,
    },
  };
};
