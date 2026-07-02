import { createRoute, z } from "@hono/zod-openapi";
import { harnessParamsInputSchema } from "pstdio-api-contracts";
import { defaultHarnessParams } from "pstdio-api-runtime-host";
import type { AppRouteHandler } from "../../../types";
import {
  filterDeclaredHarnessParams,
  HarnessParamError,
  readHarnessProjectDefaults,
  writeHarnessProjectDefaults,
} from "../../sessions/harness-params";
import type { ProjectsRouteDeps } from "../deps";

const harnessParamsResponseSchema = z.object({
  schema: z.record(z.string(), z.any()).nullable(),
  defaults: harnessParamsInputSchema,
});

const upsertHarnessParamsBodySchema = z.object({
  params: harnessParamsInputSchema,
});

export const getHarnessParamDefaultsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/harnesses/{agentId}/params",
  description: "Read project defaults for a harness's declared run params.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ projectId: z.string(), agentId: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Effective harness param defaults.",
      content: { "application/json": { schema: harnessParamsResponseSchema } },
    },
    404: {
      description: "Project or harness not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const putHarnessParamDefaultsRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/harnesses/{agentId}/params",
  description: "Update project defaults for a harness's declared run params.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ projectId: z.string(), agentId: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: upsertHarnessParamsBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Updated effective harness param defaults.",
      content: { "application/json": { schema: harnessParamsResponseSchema } },
    },
    400: {
      description: "Invalid harness params.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Project or harness not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

const getProjectAndHarness = async (deps: ProjectsRouteDeps, projectId: string, agentId: string) => {
  const project = await deps.projectService.get(projectId);
  if (!project) return { type: "error" as const, error: `Project not found: ${projectId}` };

  const harness = await deps.harnessRegistry.get(agentId, { projectId });
  if (!harness) return { type: "error" as const, error: `Harness not enabled for this project: ${agentId}` };

  return { type: "ok" as const, harness };
};

export const getHarnessParamDefaultsHandler = (
  deps: ProjectsRouteDeps,
): AppRouteHandler<typeof getHarnessParamDefaultsRoute> => {
  return async (c) => {
    const { projectId, agentId } = c.req.valid("param");
    const resolved = await getProjectAndHarness(deps, projectId, agentId);
    if (resolved.type === "error") return c.json({ error: resolved.error }, 404);

    const stored = filterDeclaredHarnessParams(
      resolved.harness.params,
      await readHarnessProjectDefaults(deps, { projectId, agentId }),
    );
    const defaults = { ...defaultHarnessParams(resolved.harness.params), ...stored };
    return c.json({ schema: resolved.harness.params, defaults }, 200);
  };
};

export const putHarnessParamDefaultsHandler = (
  deps: ProjectsRouteDeps,
): AppRouteHandler<typeof putHarnessParamDefaultsRoute> => {
  return async (c) => {
    const { projectId, agentId } = c.req.valid("param");
    const body = c.req.valid("json");
    const resolved = await getProjectAndHarness(deps, projectId, agentId);
    if (resolved.type === "error") return c.json({ error: resolved.error }, 404);

    try {
      const result = await writeHarnessProjectDefaults(deps, { projectId, agentId, params: body.params });
      const defaults = { ...defaultHarnessParams(result.schema), ...body.params };
      return c.json({ schema: result.schema, defaults }, 200);
    } catch (error) {
      if (error instanceof HarnessParamError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
};
