import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createSessionBodySchema, sessionResponseSchema } from "../dto";
import { resolveSessionCwd } from "../resolve-session-cwd";
import { spawnAgentSession } from "../spawn-agent";

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

const resolveCreateSessionAgent = async (inputAgent: string | undefined, deps: RouteDeps) => {
  if (inputAgent) {
    return inputAgent;
  }

  const configuredAgents = await deps.agentConfigService.list();
  const defaultAgent = configuredAgents.find((config) => config.is_default);
  return defaultAgent?.agent_id;
};

export const createSessionHandler = (deps: RouteDeps): AppRouteHandler<typeof createSessionRoute> => {
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
    const agentId = await resolveCreateSessionAgent(input.agent, deps);

    if (!agentId) {
      return c.json({ error: "No agent configured. Set a default agent with 'pstdio agents setup' first." }, 400);
    }

    const session = await deps.sessionService.create({
      project_id: input.project_id,
      title: input.title,
      agent: agentId,
      original_session_id: input.original_session_id,
      cwd: cwd ?? undefined,
    });

    if (resolvedWorkspaceId) {
      const link = await deps.workspaceSessionService.link(resolvedWorkspaceId, session.id);
      deps.eventBus.emit("workspace_sessions", "set", link);
    }

    spawnAgentSession(
      {
        sessionId: session.id,
        agentId,
        prompt: input.prompt,
        title: input.title,
        model: input.model,
        cwd,
      },
      deps,
    ).catch(async () => {
      await deps.sessionService.transitionStatus(session.id, "failed");
    });

    return c.json(session, 201);
  };
};
