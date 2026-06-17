import { createRoute, z } from "@hono/zod-openapi";
import type { HarnessAttachment } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { emitActivityEvent } from "../../activity/activity-events";
import type { SessionsRouteDeps } from "../deps";
import { createSessionBodySchema, sessionResponseSchema } from "../dto";
import { resolvePrompt } from "../resolve-prompt";
import { resolveSessionCwd } from "../resolve-session-cwd";
import { SessionAttachmentError, withResolvedSubmittingSessionAttachments } from "../session-attachments";
import { createSessionScheduler } from "../session-scheduler";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "./resolve-create-session";

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
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    400: {
      description: "No default agent is configured.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Project or workspace not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const createSessionHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof createSessionRoute> => {
  return async (c) => {
    const input = c.req.valid("json");

    const project = await deps.projectService.get(input.project_id);
    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    let resolvedWorkspaceId: string | undefined;
    if (input.workspace_id) {
      const workspace =
        (await deps.workspaceService.get(input.workspace_id)) ??
        (await deps.workspaceService.getByShorthand(input.project_id, input.workspace_id));
      if (!workspace) {
        return c.json({ error: `Workspace not found: ${input.workspace_id}` }, 404);
      }
      resolvedWorkspaceId = workspace.id;
    }

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

    const prompt = await resolvePrompt(input, input.project_id, deps);
    const scheduler = createSessionScheduler(deps);

    try {
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
            originalSessionId: input.original_session_id,
            cwd: cwd ?? undefined,
            anchors: input.anchors,
            onBeforeStartedHook: async (createdSession) => {
              if (resolvedWorkspaceId) {
                await deps.workspaceSessionService.link(resolvedWorkspaceId, createdSession.id);
              }

              await emitActivityEvent(deps, {
                projectId: input.project_id,
                resourceType: "session",
                resourceId: createdSession.id,
                eventType: "session_created",
                summary: `Created session ${createdSession.title}`,
                payload: {
                  status: createdSession.status,
                  workspace_id: resolvedWorkspaceId ?? null,
                },
              });
            },
          }),
      );
      return c.json(session, 201);
    } catch (error) {
      if (error instanceof SessionAttachmentError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};
