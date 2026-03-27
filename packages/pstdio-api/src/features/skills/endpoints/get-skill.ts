import { readFile } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";

export const getSkillRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills/{name}",
  description: "Get a skill by name, including its content.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Skill name" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Skill found.",
      content: { "application/json": { schema: skillWithContentResponseSchema } },
    },
    404: {
      description: "Skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getSkillHandler = (deps: RouteDeps): AppRouteHandler<typeof getSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const skill = await deps.skillsDbService.getByName(projectId, name);

    if (!skill) {
      return c.json({ error: `Skill not found: ${name}` }, 404);
    }

    const file = await deps.filesService.get(skill.file_id);
    const content = file ? await readFile(file.storage_path, "utf8") : "";

    const bundled = await getBundledSkills();
    const bundledSkill = bundled.find((s) => s.name === name);
    const bundled_version = bundledSkill?.version ?? "";

    return c.json({ ...skill, content, bundled_version }, 200);
  };
};
