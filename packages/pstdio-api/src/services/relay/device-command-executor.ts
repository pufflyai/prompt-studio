import { OpenAPIHono } from "@hono/zod-openapi";
import { type DeviceCommand, deviceCommandSchema } from "pstdio-api-contracts";
import { type Json, jsonSchema } from "pstdio-sync-contracts";
import { approveSessionHandler, approveSessionRoute } from "../../features/sessions/endpoints/approve-session";
import { createSessionHandler, createSessionRoute } from "../../features/sessions/endpoints/create-session";
import { followUpSessionHandler, followUpSessionRoute } from "../../features/sessions/endpoints/follow-up-session";
import {
  getQueuedMessagesHandler,
  getQueuedMessagesRoute,
} from "../../features/sessions/endpoints/get-queued-messages";
import {
  combineQueuedFollowUpsHandler,
  combineQueuedFollowUpsRoute,
  pendingQueuedFollowUpsHandler,
  pendingQueuedFollowUpsRoute,
} from "../../features/sessions/endpoints/pending-queued-follow-ups";
import {
  deleteQueuedFollowUpHandler,
  deleteQueuedFollowUpRoute,
  moveQueuedFollowUpHandler,
  moveQueuedFollowUpRoute,
  updateQueuedFollowUpHandler,
  updateQueuedFollowUpRoute,
} from "../../features/sessions/endpoints/queued-follow-ups";
import { resolveCreateWorkspace } from "../../features/sessions/endpoints/resolve-create-workspace";
import {
  updateSessionStatusHandler,
  updateSessionStatusRoute,
} from "../../features/sessions/endpoints/update-session-status";
import { createWorkspaceHandler, createWorkspaceRoute } from "../../features/workspaces/endpoints/create-workspace";
import {
  getWorkspaceDiffFileHandler,
  getWorkspaceDiffFileRoute,
  getWorkspaceDiffFilesHandler,
  getWorkspaceDiffFilesRoute,
  getWorkspaceDiffHandler,
  getWorkspaceDiffRoute,
} from "../../features/workspaces/endpoints/get-workspace-diff";
import {
  getWorkspaceDiffSummaryHandler,
  getWorkspaceDiffSummaryRoute,
} from "../../features/workspaces/endpoints/get-workspace-diff-summary";
import {
  getWorkspaceFileHandler,
  getWorkspaceFileRoute,
  listWorkspaceFilesHandler,
  listWorkspaceFilesRoute,
} from "../../features/workspaces/endpoints/workspace-files";
import type { AppBindings } from "../../types";
import type { RelayDeps } from "./deps";
import { executeWithDeviceAttachments } from "./device-command-attachments";

const requestFor = (command: DeviceCommand) => {
  if (command.type === "session.create") return { path: "/sessions", method: "POST", body: command.input };
  if (command.type === "workspace.create") return { path: "/workspaces", method: "POST", body: command.input };
  const id = encodeURIComponent(command.id);
  switch (command.type) {
    case "session.queuedMessages":
      return { path: `/sessions/${id}/queued-messages`, method: "GET" };
    case "session.queuedFollowUps":
      return { path: `/sessions/${id}/queued-follow-ups`, method: "GET" };
    case "session.queueUpdate":
      return {
        path: `/sessions/${id}/queued-follow-ups/${command.queuePosition}`,
        method: "PATCH",
        body: command.input,
      };
    case "session.queueDelete":
      return {
        path: `/sessions/${id}/queued-follow-ups/${command.queuePosition}?${new URLSearchParams(command.expectedRevision ? { expectedRevision: command.expectedRevision } : {})}`,
        method: "DELETE",
      };
    case "session.queueMove":
      return {
        path: `/sessions/${id}/queued-follow-ups/${command.queuePosition}/move`,
        method: "POST",
        body: command.input,
      };
    case "session.queueCombine":
      return {
        path: `/sessions/${id}/queued-follow-ups/${command.queuePosition}/combine`,
        method: "POST",
        body: command.input,
      };
    case "session.interrupt":
      return { path: `/sessions/${id}/status`, method: "PATCH", body: { status: "cancelled" } };
    case "session.followUp":
      return { path: `/sessions/${id}/follow-up`, method: "POST", body: command.input };
    case "session.approve":
      return { path: `/sessions/${id}/approve`, method: "POST", body: command.input };
    case "workspace.readFile":
      return { path: `/workspaces/${id}/file?${new URLSearchParams({ path: command.path })}`, method: "GET" };
    case "workspace.diff":
      return { path: `/workspaces/${id}/diff?mode=${command.mode ?? "current"}`, method: "GET" };
    case "workspace.diffFiles":
      return { path: `/workspaces/${id}/diff-files?mode=${command.mode ?? "current"}`, method: "GET" };
    case "workspace.diffSummary":
      return { path: `/workspaces/${id}/diff-summary?mode=${command.mode ?? "current"}`, method: "GET" };
    case "workspace.diffFile":
      return {
        path: `/workspaces/${id}/diff-file?${new URLSearchParams({ mode: command.mode ?? "current", path: command.path })}`,
        method: "GET",
      };
    case "workspace.listFiles": {
      const query = new URLSearchParams();
      if (command.path !== undefined) query.set("path", command.path);
      if (command.query !== undefined) query.set("query", command.query);
      if (command.limit !== undefined) query.set("limit", String(command.limit));
      return { path: `/workspaces/${id}/files?${query}`, method: "GET" };
    }
  }
};

/** Reuse the local actions and their validation. The relay cannot select an arbitrary host route. */
export const createDeviceCommandExecutor = (deps: RelayDeps, projectId: string) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(getQueuedMessagesRoute, getQueuedMessagesHandler(deps));
  routes.openapi(pendingQueuedFollowUpsRoute, pendingQueuedFollowUpsHandler(deps));
  routes.openapi(updateQueuedFollowUpRoute, updateQueuedFollowUpHandler(deps));
  routes.openapi(deleteQueuedFollowUpRoute, deleteQueuedFollowUpHandler(deps));
  routes.openapi(moveQueuedFollowUpRoute, moveQueuedFollowUpHandler(deps));
  routes.openapi(combineQueuedFollowUpsRoute, combineQueuedFollowUpsHandler(deps));
  routes.openapi(createSessionRoute, createSessionHandler(deps));
  routes.openapi(followUpSessionRoute, followUpSessionHandler(deps));
  routes.openapi(approveSessionRoute, approveSessionHandler(deps));
  routes.openapi(updateSessionStatusRoute, updateSessionStatusHandler(deps));
  routes.openapi(createWorkspaceRoute, createWorkspaceHandler(deps));
  routes.openapi(listWorkspaceFilesRoute, listWorkspaceFilesHandler(deps));
  routes.openapi(getWorkspaceFileRoute, getWorkspaceFileHandler(deps));
  routes.openapi(getWorkspaceDiffRoute, getWorkspaceDiffHandler(deps));
  routes.openapi(getWorkspaceDiffFilesRoute, getWorkspaceDiffFilesHandler(deps));
  routes.openapi(getWorkspaceDiffFileRoute, getWorkspaceDiffFileHandler(deps));
  routes.openapi(getWorkspaceDiffSummaryRoute, getWorkspaceDiffSummaryHandler(deps));
  const localSession = async (id: string) => (await deps.sessionService.get(id))?.project_id === projectId;
  const localWorkspace = async (id: string) => (await deps.workspaceService.get(id))?.project_id === projectId;
  const inScope = async (command: DeviceCommand) => {
    if (command.type === "session.create") {
      const input = command.input;
      return (
        input.projectId === projectId &&
        (!input.workspaceId || Boolean((await resolveCreateWorkspace(deps, projectId, input.workspaceId)).workspace)) &&
        (!input.originalSessionId || (await localSession(input.originalSessionId)))
      );
    }
    if (command.type === "workspace.create") return command.input.projectId === projectId;
    if (command.type.startsWith("workspace.")) return localWorkspace(command.id);
    if (!(await localSession(command.id))) return false;
    return (
      command.type !== "session.followUp" ||
      !command.input.summaryFromSessionId ||
      (await localSession(command.input.summaryFromSessionId))
    );
  };
  return async (value: Json, context: { signal: AbortSignal }) => {
    context.signal.throwIfAborted();
    const command = deviceCommandSchema.parse(value);
    if (!(await inScope(command)))
      return { status: 404, body: { error: "Resource not found on this device in this project" } };
    context.signal.throwIfAborted();
    return jsonSchema.parse(
      await executeWithDeviceAttachments(deps, projectId, command, async () => {
        context.signal.throwIfAborted();
        const request = requestFor(command);
        const response = await routes.request(request.path, {
          method: request.method,
          signal: context.signal,
          headers: { "content-type": "application/json" },
          ...("body" in request ? { body: JSON.stringify(request.body) } : {}),
        });
        return { status: response.status, body: jsonSchema.parse(await response.json()) };
      }),
    );
  };
};
