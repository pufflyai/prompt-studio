import { createRoute, z } from "@hono/zod-openapi";
import { attemptExtensionFixResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { emitActivityEvent } from "../../activity/activity-events";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../../sessions/endpoints/resolve-create-session";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { ExtensionsRouteDeps } from "../deps";

const errorSchema = z.object({ error: z.string() });

const describeError = (error: Record<string, unknown>) => {
  const lines = [
    typeof error.code === "string" ? `Error code: ${error.code}` : null,
    typeof error.message === "string" ? `Error message: ${error.message}` : null,
  ];
  const diagnostics = Array.isArray(error.diagnostics) ? error.diagnostics : [];
  for (const diagnostic of diagnostics) {
    if (typeof diagnostic === "object" && diagnostic !== null && "message" in diagnostic) {
      lines.push(`- ${(diagnostic as { code?: string }).code ?? "diagnostic"}: ${String(diagnostic.message)}`);
    }
  }
  return lines.filter(Boolean).join("\n");
};

const buildFixPrompt = (input: {
  displayName: string;
  extensionId: string;
  sourcePath: string;
  error: Record<string, unknown>;
}) =>
  [
    `The Prompt Studio extension "${input.displayName}" (${input.extensionId}) failed to load.`,
    "",
    `Extension source path: ${input.sourcePath}`,
    describeError(input.error),
    "",
    "Investigate the extension source at the path above and fix the cause of the load failure.",
    "Verify the fix by running `pst extensions check` and confirming the extension loads without errors.",
  ].join("\n");

export const attemptFixProjectExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/attempt-fix",
  description: "Start an agent session that attempts to fix an extension load error.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Created repair session.",
      content: { "application/json": { schema: attemptExtensionFixResponseSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension has no load error to fix.",
      content: { "application/json": { schema: errorSchema } },
    },
    422: {
      description: "No harness available to run the repair session.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const attemptFixProjectExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof attemptFixProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    const { installedSource } = existing;
    const lastError = installedSource.last_error_json as Record<string, unknown> | null;
    if (installedSource.status !== "error" || !lastError) {
      return c.json({ error: "Extension has no load error to fix" }, 409);
    }

    const project = await deps.projectService.get(projectId);
    if (!project) return c.json({ error: `Project not found: ${projectId}` }, 404);

    const resolvedAgent = await resolveCreateSessionAgent(undefined, project, deps.harnessRegistry);
    if (resolvedAgent.type === "error" || !resolvedAgent.agentId) {
      return c.json({ error: "No harness available. Install and enable a harness extension first." }, 422);
    }

    const model = await resolveCreateSessionModel(undefined, project, resolvedAgent.agentId, deps.harnessRegistry, {
      requestAgentWasOmitted: true,
    });
    const title = `Fix extension: ${installedSource.display_name}`;
    const session = await createSessionScheduler(deps).createAndStartSession({
      projectId,
      title,
      agentId: resolvedAgent.agentId,
      prompt: buildFixPrompt({
        displayName: installedSource.display_name,
        extensionId: installedSource.extension_id,
        sourcePath: installedSource.source_path,
        error: lastError,
      }),
      model,
      cwd: installedSource.source_path,
    });
    await emitActivityEvent(deps, {
      projectId,
      resourceType: "session",
      resourceId: session.id,
      eventType: "session_created",
      summary: `Created session ${session.title}`,
      payload: { status: session.status, workspace_id: null },
    });

    return c.json({ sessionId: session.id, title: session.title }, 200);
  };
};
