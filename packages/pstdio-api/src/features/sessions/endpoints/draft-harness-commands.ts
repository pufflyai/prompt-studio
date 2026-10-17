import { createRoute, z } from "@hono/zod-openapi";
import type { Workspace } from "pstdio-api-contracts";
import { draftHarnessCommandInputSchema, harnessCommandStateSchema } from "pstdio-api-contracts";
import { HarnessDisposedError } from "pstdio-api-runtime-host";
import type { AppRouteHandler } from "../../../types";
import { readCurrentHarness } from "../../harnesses/read-current-harness";
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

const workspaceReady = (workspace: Workspace) =>
  !workspace.initializing && !workspace.setup_error && workspace.provider_state === "ready";

export const draftHarnessCommandsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof draftHarnessCommandsRoute> =>
  async (c) => {
    const input = c.req.valid("json");
    const project = await deps.projectService.get(input.project_id);
    if (!project) return c.json({ error: "Project not found." }, 404);
    if (!(await deps.harnessRegistry.get(input.agent, { projectId: input.project_id })))
      return c.json({ error: "The selected harness is not enabled for this project." }, 404);
    const resolved = await resolveCreateWorkspace(deps, input.project_id, input.workspace_id);
    if (resolved.error) return c.json({ error: resolved.error }, resolved.status);
    const record = resolved.workspace!;
    if (!workspaceReady(record)) return c.json({ error: "The workspace is not ready." }, 409);
    const workspace = toHarnessWorkspaceContext(record)!;
    const cwd = workspace.executionTarget.kind === "local" ? workspace.executionTarget.rootPath : undefined;
    try {
      const model = await resolveCreateSessionModel(input.model, project, input.agent, deps.harnessRegistry, {
        requestAgentWasOmitted: false,
      });
      const params = await resolveHarnessRunParams(deps, {
        projectId: input.project_id,
        agentId: input.agent,
        model,
        overrides: input.params,
      });
      // Model discovery may finish after an extension refresh retires its provider.
      const response = await readCurrentHarness(
        deps.harnessRegistry,
        input.agent,
        { projectId: input.project_id },
        async (harness) => {
          if (workspace.executionTarget.kind === "remote" && harness.cwdRequirement === "required")
            return c.json({ error: "This harness requires a local workspace." }, 400);
          const state = await harness.getCommandState(
            { workspace, cwd, model, params },
            { projectId: input.project_id },
          );
          return c.json({ ...state, harnessId: harness.id }, 200);
        },
      );
      return response ?? c.json({ error: "The selected harness is not enabled for this project." }, 404);
    } catch (error) {
      if (error instanceof HarnessDisposedError)
        return c.json({ error: "The harness changed during discovery. Try again." }, 409);
      if (error instanceof HarnessParamError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
