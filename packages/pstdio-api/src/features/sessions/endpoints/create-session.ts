import { createRoute, z } from "@hono/zod-openapi";
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
    body: {
      content: { "application/json": { schema: createSessionBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Session created.",
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    404: {
      description: "Project or workspace not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    409: {
      description: "Workspace already has an active session.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const createSessionHandler = (deps: RouteDeps) => {
  return async (c: any) => {
    const input = c.req.valid("json");

    const project = await deps.projectsService.get(input.project_id);
    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    if (input.workspace_id) {
      const workspace = await deps.workspacesService.get(input.workspace_id);
      if (!workspace) {
        return c.json({ error: `Workspace not found: ${input.workspace_id}` }, 404);
      }

      if (workspace.session_id) {
        const existingSession = await deps.sessionsService.get(workspace.session_id);
        if (existingSession && existingSession.status === "in_progress") {
          return c.json({ error: `Workspace already has an active session: ${workspace.session_id}` }, 409);
        }
      }
    }

    const session = await deps.sessionsService.create({
      project_id: input.project_id,
      title: input.title,
      agent: input.agent,
    });

    deps.eventBus.emit("sessions", "set", session);

    const cwd = await resolveSessionCwd(deps, input.project_id, input.workspace_id);

    spawnAgentSession(
      {
        sessionId: session.id,
        agentId: input.agent,
        prompt: input.prompt,
        title: input.title,
        model: input.model,
        cwd,
      },
      deps,
    );

    return c.json(session, 201);
  };
};
