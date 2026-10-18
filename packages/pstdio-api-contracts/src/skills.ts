import { z } from "zod";
import { packageAssetDescriptorSchema } from "./extensions";

export const skillFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.literal("utf8"),
});

export const skillSourceKindSchema = z.enum(["project", "extension"]);

export const skillAgentInstallationSchema = z.object({
  agent_id: z.string(),
  agent_name: z.string(),
  installed_version: z.string().nullable(),
});

export const skillSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  source_kind: skillSourceKindSchema,
  files: z.array(skillFileSchema),
  editable: z.boolean(),
  extension_instance_id: z.string().optional(),
  extension_id: z.string().optional(),
  installed_extension_id: z.string().optional(),
  install_name: z.string().optional(),
  key: z.string().optional(),
  source: packageAssetDescriptorSchema.optional(),
  enabled: z.boolean().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const skillWithContentSchema = skillSchema.extend({
  installed_agents: z.array(z.string()),
  agent_installations: z.array(skillAgentInstallationSchema),
});

export const updateSkillInputSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

/** @deprecated Use SkillDetails. Legacy fields stay available through 0.44. */
export type Skill = z.infer<typeof skillSchema>;
export type SkillAgentInstallation = z.infer<typeof skillAgentInstallationSchema>;
/** @deprecated Use SkillWithContentDetails. Legacy fields stay available through 0.44. */
export type SkillWithContent = z.infer<typeof skillWithContentSchema>;
export type SkillFile = z.infer<typeof skillFileSchema>;
export type SkillSourceKind = z.infer<typeof skillSourceKindSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;

export const skillDetailsSchema = skillSchema
  .omit({
    project_id: true,
    source_kind: true,
    extension_instance_id: true,
    extension_id: true,
    installed_extension_id: true,
    install_name: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
  })
  .extend({
    projectId: z.string(),
    sourceKind: skillSourceKindSchema,
    extensionInstanceId: z.string().optional(),
    extensionId: z.string().optional(),
    installedExtensionId: z.string().optional(),
    installName: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  });
export const skillAgentInstallationDetailsSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  installedVersion: z.string().nullable(),
});
export const skillWithContentDetailsSchema = skillDetailsSchema.extend({
  installedAgents: z.array(z.string()),
  agentInstallations: z.array(skillAgentInstallationDetailsSchema),
});
export type SkillDetails = z.infer<typeof skillDetailsSchema>;
export type SkillWithContentDetails = z.infer<typeof skillWithContentDetailsSchema>;
