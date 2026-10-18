import { z } from "@hono/zod-openapi";
import {
  type Skill,
  skillDetailsSchema,
  skillSchema,
  skillWithContentDetailsSchema,
  skillWithContentSchema,
  updateSkillInputSchema,
} from "pstdio-api-contracts";

export const skillResponseSchema = skillSchema.extend(skillDetailsSchema.shape);
export const skillWithContentResponseSchema = skillWithContentSchema.extend(skillWithContentDetailsSchema.shape);
export const updateSkillBodySchema = updateSkillInputSchema.strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
export const badRequestResponseSchema = z.object({ error: z.string() });

export const toSkillResponse = (skill: Skill) => ({
  ...skill,
  projectId: skill.project_id,
  sourceKind: skill.source_kind,
  extensionInstanceId: skill.extension_instance_id,
  extensionId: skill.extension_id,
  installedExtensionId: skill.installed_extension_id,
  installName: skill.install_name,
  createdAt: skill.created_at,
  updatedAt: skill.updated_at,
  deletedAt: skill.deleted_at,
});
