import { createRoute, z } from "@hono/zod-openapi";
import { sessionLogger } from "../../../lib/logger";
import type { AppRouteHandler } from "../../../types";
import { emitActivityEvent } from "../../activity/activity-events";
import type { SessionsRouteDeps } from "../deps";
import { createSessionBodySchema, sessionResponseSchema } from "../dto";
import { resolvePrompt } from "../resolve-prompt";
import { resolveSessionCwd } from "../resolve-session-cwd";
import { spawnAgentSession } from "../spawn-agent";
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
    const configuredAgents = await deps.agentConfigService.list();
    const resolvedAgent = resolveCreateSessionAgent(input.agent, project, configuredAgents, deps.agentRegistry);

    if (resolvedAgent.type === "error") {
      return c.json({ error: resolvedAgent.error }, 400);
    }

    const { agentId } = resolvedAgent;

    if (!agentId) {
      return c.json({ error: "No agent configured. Set a default agent with 'pstdio agents setup' first." }, 400);
    }

    const resolvedModel = resolveCreateSessionModel(input.model, project, agentId, deps.agentRegistry, {
      requestAgentWasOmitted: !input.agent,
    });

    const prompt = await resolvePrompt(input, input.project_id, deps);

    const session = await deps.sessionService.create({
      project_id: input.project_id,
      title: input.title,
      agent: agentId,
      last_selected_model: resolvedModel,
      original_session_id: input.original_session_id,
      cwd: cwd ?? undefined,
    });

    if (resolvedWorkspaceId) {
      const link = await deps.workspaceSessionService.link(resolvedWorkspaceId, session.id);
      deps.eventBus.emit("workspace_sessions", "set", link);
    }

    await emitActivityEvent(deps, {
      projectId: input.project_id,
      resourceType: "session",
      resourceId: session.id,
      eventType: "session_created",
      summary: `Created session ${session.title}`,
      payload: {
        status: session.status,
        workspace_id: resolvedWorkspaceId ?? null,
      },
    });

    spawnAgentSession(
      {
        sessionId: session.id,
        agentId,
        prompt,
        title: input.title,
        model: resolvedModel,
        cwd,
      },
      deps,
    ).catch(async (error) => {
      sessionLogger.error(
        {
          err: error,
          event: "session.spawn.failed",
          session_id: session.id,
          project_id: input.project_id,
          agent: agentId,
          cwd: cwd ?? null,
          model: resolvedModel ?? null,
        },
        "Agent session startup failed",
      );
      await deps.sessionService.transitionStatus(session.id, "failed");
    });

    return c.json(session, 201);
  };
};
