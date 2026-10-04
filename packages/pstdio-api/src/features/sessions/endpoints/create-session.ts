import { createRoute, z } from "@hono/zod-openapi";
import { createSessionResponseSchema, type HarnessAttachment, type HarnessParams } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { emitActivityEvent } from "../../activity/activity-events";
import type { SessionsRouteDeps } from "../deps";
import { createSessionBodySchema } from "../dto";
import { HarnessParamError, resolveHarnessRunParams } from "../harness-params";
import { resolveSessionCwd } from "../resolve-session-cwd";
import { SessionAttachmentError, withResolvedSubmittingSessionAttachments } from "../session-attachments";
import { createSessionHarnessOperation, HarnessOperationError } from "../session-harness-commands";
import { createSessionScheduler } from "../session-scheduler";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "./resolve-create-session";
import { resolveCreateWorkspace } from "./resolve-create-workspace";

export const createSessionRoute = createRoute({
  method: "post",
  path: "/sessions",
  description: "Create a new session and start the agent.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createSessionBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Session created.",
      content: { "application/json": { schema: createSessionResponseSchema } },
    },
    400: {
      description: "No default agent is configured.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Project or workspace not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    409: {
      description: "Conflicting native work.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

const resolveCreateSessionParams = async (
  deps: SessionsRouteDeps,
  input: { projectId: string; agentId: string; model?: string; overrides?: HarnessParams },
) => {
  try {
    const params = await resolveHarnessRunParams(deps, input);
    return { type: "ok" as const, params };
  } catch (error) {
    if (error instanceof HarnessParamError) return { type: "error" as const, error: error.message };
    throw error;
  }
};
const creationFailure = (error: unknown) => {
  if (error instanceof HarnessOperationError) return { error: error.message, status: error.status };
  if (error instanceof SessionAttachmentError) return { error: error.message, status: 400 as const };
  throw error;
};

export const createSessionHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof createSessionRoute> => {
  return async (c) => {
    const input = c.req.valid("json");

    const project = await deps.projectService.get(input.project_id);
    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    const resolvedWorkspace = await resolveCreateWorkspace(deps, input.project_id, input.workspace_id);
    if (resolvedWorkspace.error) return c.json({ error: resolvedWorkspace.error }, resolvedWorkspace.status);
    const resolvedWorkspaceId = resolvedWorkspace.workspace!.id;
    const cwd = await resolveSessionCwd(deps, input.project_id, resolvedWorkspaceId);
    const resolvedAgent = await resolveCreateSessionAgent(input.agent, project, deps.harnessRegistry);

    if (resolvedAgent.type === "error") {
      return c.json({ error: resolvedAgent.error }, 400);
    }

    const { agentId } = resolvedAgent;

    if (!agentId) {
      return c.json({ error: "No harness available. Install and enable a harness extension first." }, 400);
    }

    const resolvedModel = await resolveCreateSessionModel(input.model, project, agentId, deps.harnessRegistry, {
      requestAgentWasOmitted: !input.agent,
    });
    const resolvedParams = await resolveCreateSessionParams(deps, {
      projectId: input.project_id,
      agentId,
      model: resolvedModel,
      overrides: input.params,
    });
    if (resolvedParams.type === "error") return c.json({ error: resolvedParams.error }, 400);

    const prompt = input.prompt ?? "";
    const scheduler = createSessionScheduler(deps);

    const onCreated = async (session: { id: string; title: string; status: string }) => {
      await deps.workspaceSessionService.link(resolvedWorkspaceId, session.id);
      await emitActivityEvent(deps, {
        projectId: input.project_id,
        resourceType: "session",
        resourceId: session.id,
        eventType: "session_created",
        summary: `Created session ${session.title}`,
        payload: { status: session.status, workspace_id: resolvedWorkspaceId },
      });
    };

    try {
      if (input.operation) {
        const session = await createSessionHarnessOperation(
          deps,
          {
            project_id: input.project_id,
            title: input.title,
            agent: agentId,
            last_selected_model: resolvedModel,
            params_json: resolvedParams.params,
            original_session_id: input.original_session_id,
            cwd,
            anchors: input.anchors,
          },
          input.operation,
          onCreated,
          c.req.raw.signal,
        );
        return c.json(session, 201);
      }
      const session = await withResolvedSubmittingSessionAttachments(
        deps,
        input.project_id,
        input.attachments,
        async (attachments: HarnessAttachment[]) =>
          scheduler.createAndStartSession({
            projectId: input.project_id,
            title: input.title,
            agentId,
            prompt,
            attachments,
            attachmentRefs: input.attachments,
            model: resolvedModel,
            params: resolvedParams.params,
            originalSessionId: input.original_session_id,
            cwd: cwd ?? undefined,
            anchors: input.anchors,
            onBeforeStartedHook: onCreated,
          }),
      );
      return c.json(session, 201);
    } catch (error) {
      const failure = creationFailure(error);
      return c.json({ error: failure.error }, failure.status);
    }
  };
};
