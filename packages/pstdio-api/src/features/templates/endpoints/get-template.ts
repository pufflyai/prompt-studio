import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { Template } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, templateWithContentResponseSchema } from "../dto";
import { findExtensionTemplate, readExtensionTemplateContent } from "../registry/extension-content";
import { extensionDefaultTemplateId, extensionDefaultTemplateName } from "../registry/list-registry";

export const getTemplateRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/templates/{name}",
  description:
    "Get a template by name, including its content. Resolves project-owned templates first and falls back to extension-provided defaults (`<namespace>.<key>`).",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z
          .string()
          .openapi({ description: "Template name (project name or `<namespace>.<key>` for extension defaults)" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Template found.",
      content: { "application/json": { schema: templateWithContentResponseSchema } },
    },
    404: {
      description: "Template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const projectTemplateAsContractTemplate = (template: {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string;
  is_default: boolean;
  origin_extension_id: string | null;
  origin_template_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Template => ({
  id: template.id,
  project_id: template.project_id,
  name: template.name,
  template_type: template.template_type,
  file_id: template.file_id,
  is_default: template.is_default,
  source_kind: "project",
  read_only: false,
  extension_id: null,
  template_key: null,
  origin_extension_id: template.origin_extension_id,
  origin_template_key: template.origin_template_key,
  created_at: template.created_at,
  updated_at: template.updated_at,
  deleted_at: template.deleted_at,
});

const parseNamespacedName = (name: string) => {
  const dot = name.indexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return { namespace: name.slice(0, dot), key: name.slice(dot + 1) };
};

const resolveExtensionDefault = async (deps: RouteDeps, name: string) => {
  const parsed = parseNamespacedName(name);
  if (!parsed) return null;

  const checkResult = await deps.extensionService.check();
  const record = checkResult.runtime.templates.find(
    (entry) => entry.namespace === parsed.namespace && entry.localId === parsed.key,
  );
  if (!record) return null;

  return findExtensionTemplate(deps, record.extensionId, record.localId);
};

export const getTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof getTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const projectTemplate = await deps.templateService.getByName(projectId, name);

    if (projectTemplate) {
      const file = await deps.fileService.get(projectTemplate.file_id);
      const content = file ? readFileSync(file.storage_path, "utf8") : "";
      return c.json({ ...projectTemplateAsContractTemplate(projectTemplate), content }, 200);
    }

    const extensionTemplate = await resolveExtensionDefault(deps, name);
    if (extensionTemplate) {
      const enabled = await deps.extensionService.templatePreferences.isEnabled(
        projectId,
        extensionTemplate.record.extensionId,
        extensionTemplate.record.localId,
      );
      let content = "";
      try {
        content = await readExtensionTemplateContent(extensionTemplate);
      } catch {
        content = "";
      }
      const record = extensionTemplate.record;
      const synthetic: Template = {
        id: extensionDefaultTemplateId(record.extensionId, record.localId),
        project_id: projectId,
        name: extensionDefaultTemplateName(record),
        template_type: record.contribution.type,
        file_id: "",
        is_default: false,
        source_kind: "extension-default",
        read_only: true,
        extension_id: record.extensionId,
        template_key: record.localId,
        origin_extension_id: null,
        origin_template_key: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
        deleted_at: enabled ? null : new Date(0).toISOString(),
      };
      return c.json({ ...synthetic, content }, 200);
    }

    return c.json({ error: `Template not found: ${name}` }, 404);
  };
};
