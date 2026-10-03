import { createRoute, z } from "@hono/zod-openapi";
import { draftHarnessCommandInputSchema, harnessCommandStateSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { HarnessParamError, resolveHarnessRunParams } from "../harness-params";
import { toHarnessWorkspaceContext } from "../session-workspace-context";
import { resolveCreateSessionModel } from "./resolve-create-session";
import { resolveCreateWorkspace } from "./resolve-create-workspace";

const errorResponse = {
  description: "Project, harness, workspace, or parameters are unavailable.",
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
};
export const draftHarnessCommandsRoute = createRoute({
  method: "post",
  path: "/sessions/harness-command-state",
  tags: ["Sessions"],
  description: "Discover native commands for a new conversation without creating a session.",
  request: { body: { content: { "application/json": { schema: draftHarnessCommandInputSchema } } } },
  responses: {
    200: {
      description: "Selected harness commands and modes.",
      content: { "application/json": { schema: harnessCommandStateSchema.extend({ harnessId: z.string() }) } },
    },
    400: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
});
export const draftHarnessCommandsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof draftHarnessCommandsRoute> =>
  async (c) => {
    const input = c.req.valid("json");
    if (!(await deps.projectService.get(input.project_id))) return c.json({ error: "Project not found." }, 404);
    const harness = await deps.harnessRegistry.get(input.agent, { projectId: input.project_id });
    if (!harness) return c.json({ error: "The selected harness is not enabled for this project." }, 404);
    const resolved = await resolveCreateWorkspace(deps, input.project_id, input.workspace_id);
    if (resolved.error) return c.json({ error: resolved.error }, resolved.status);
    const record = resolved.workspace!;
    if (record.initializing || record.setup_error || record.provider_state !== "ready")
      return c.json({ error: "The workspace is not ready." }, 409);
    const workspace = toHarnessWorkspaceContext(record);
    if (workspace?.executionTarget.kind === "remote" && harness.cwdRequirement === "required")
      return c.json({ error: "This harness requires a local workspace." }, 400);
    try {
      const project = (await deps.projectService.get(input.project_id))!;
      const model = await resolveCreateSessionModel(input.model, project, input.agent, deps.harnessRegistry, {
        requestAgentWasOmitted: false,
      });
      const params = await resolveHarnessRunParams(deps, {
        projectId: input.project_id,
        agentId: input.agent,
        model,
        overrides: input.params,
      });
      const state = await harness.getCommandState(
        {
          workspace,
          cwd: workspace?.executionTarget.kind === "local" ? workspace.executionTarget.rootPath : undefined,
          model,
          params,
        },
        { projectId: input.project_id },
      );
      return c.json({ ...state, harnessId: harness.id }, 200);
    } catch (error) {
      if (error instanceof HarnessParamError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
