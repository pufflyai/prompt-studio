import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import {
  badRequestResponseSchema,
  forbiddenResponseSchema,
  notFoundResponseSchema,
  templateResponseSchema,
  updateTemplateBodySchema,
} from "../dto";
import { isExtensionDefaultName } from "../registry/extension-default-names";
import { projectTemplateRowToTemplate } from "../registry/project-template-mapper";

export const updateTemplateRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/templates/{name}",
  description: "Update a template's content, type, or default status.",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Template name" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateTemplateBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Template updated.",
      content: { "application/json": { schema: templateResponseSchema } },
    },
    403: {
      description: "Template is a read-only extension default.",
      content: { "application/json": { schema: forbiddenResponseSchema } },
    },
    404: {
      description: "Template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    400: {
      description: "Invalid template update request.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

type TemplateUpdateError = "not_found" | "cannot_change_only_default_template_type";
type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;

const buildUpdateError = (name: string, error: TemplateUpdateError) => {
  if (error === "cannot_change_only_default_template_type") {
    return {
      body: { error: "Cannot change template_type for the only default template in its current type" },
      status: 400 as const,
    };
  }

  return { body: { error: `Template not found: ${name}` }, status: 404 as const };
};

const getEditableTemplate = async (deps: RouteDeps, projectId: string, name: string) => {
  const existing = await deps.templateService.getByName(projectId, name);
  if (existing?.file_id) return { ok: true as const, template: existing };

  const isReadOnlyDefault = Boolean(existing) || (await isExtensionDefaultName(deps, name));
  if (!isReadOnlyDefault) {
    return { ok: false as const, body: { error: `Template not found: ${name}` }, status: 404 as const };
  }

  return {
    ok: false as const,
    body: {
      error: `Template "${name}" is a read-only extension default. Copy it to create an editable project variation.`,
    },
    status: 403 as const,
  };
};

const updateTemplateMetadata = async (
  deps: RouteDeps,
  projectId: string,
  name: string,
  body: UpdateTemplateBody,
  current: NonNullable<Awaited<ReturnType<RouteDeps["templateService"]["getByName"]>>>,
) => {
  if (body.is_default === undefined && body.template_type === undefined) {
    return { ok: true as const, template: current };
  }

  const result = await deps.templateService.update(projectId, name, {
    is_default: body.is_default,
    template_type: body.template_type,
  });

  if ("error" in result) return { ok: false as const, error: result.error ?? "not_found" };

  return { ok: true as const, template: result.template };
};

const updateTemplateContent = async (
  deps: RouteDeps,
  projectId: string,
  name: string,
  body: UpdateTemplateBody,
  current: NonNullable<Awaited<ReturnType<RouteDeps["templateService"]["getByName"]>>>,
) => {
  if (!body.content || !current.file_id) return { ok: true as const, template: current };

  const file = await deps.fileService.update(current.file_id, {
    data: Buffer.from(body.content),
  });

  if (!file) return { ok: true as const, template: current };

  const result = await deps.templateService.update(projectId, name, {
    file_id: file.id,
  });

  if ("error" in result) return { ok: false as const, error: result.error ?? "not_found" };

  return { ok: true as const, template: result.template };
};

export const updateTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");

    const editable = await getEditableTemplate(deps, projectId, name);
    if (!editable.ok) return c.json(editable.body, editable.status);

    const metadataResult = await updateTemplateMetadata(deps, projectId, name, body, editable.template);
    if (!metadataResult.ok) {
      const errorResponse = buildUpdateError(name, metadataResult.error);
      return c.json(errorResponse.body, errorResponse.status);
    }

    const contentResult = await updateTemplateContent(deps, projectId, name, body, metadataResult.template);
    if (!contentResult.ok) {
      const errorResponse = buildUpdateError(name, contentResult.error);
      return c.json(errorResponse.body, errorResponse.status);
    }

    const response = projectTemplateRowToTemplate(contentResult.template);
    deps.eventBus.emit("templates", "set", response);

    return c.json(response, 200);
  };
};
