import { z } from "zod";
import { serializableJsonObjectSchema } from "./extensions/common";

export const initialWorkspaceSchema = z.object({
  provider_id: z.string().min(1),
  params: serializableJsonObjectSchema.default({}),
});

export const extensionSetupWarningSchema = z.object({
  code: z.literal("extension_setup_failed"),
  extension: z.string(),
  message: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shorthand: z.string(),
  default_agent_id: z.string().nullable(),
  default_agent_model: z.string().nullable(),
  startup_script: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  extension_warnings: z.array(extensionSetupWarningSchema).optional(),
});

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  initial_workspace: initialWorkspaceSchema,
  agents: z.array(z.string().min(1)).min(1).optional(),
});

export const updateProjectInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    default_agent_id: z.string().min(1).nullable().optional(),
    default_agent_model: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

/** @deprecated Use ProjectDetails. Legacy fields stay available through 0.44. */
export type Project = z.infer<typeof projectSchema>;
export type ExtensionSetupWarning = z.infer<typeof extensionSetupWarningSchema>;
/** @deprecated Use ProjectCreateRequest. Legacy fields stay available through 0.44. */
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
/** @deprecated Use ProjectUpdateRequest. Legacy fields stay available through 0.44. */
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

/** Canonical project JSON. Snake-case fields remain available through 0.44. */
export const projectDetailsSchema = z.object({
  id: z.string(),
  name: z.string(),
  shorthand: z.string(),
  defaultAgentId: z.string().nullable(),
  defaultAgentModel: z.string().nullable(),
  startupScript: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  extensionWarnings: z.array(extensionSetupWarningSchema).optional(),
});
export type ProjectDetails = z.infer<typeof projectDetailsSchema>;

export const initialWorkspaceRequestSchema = z.object({
  providerId: z.string().min(1),
  params: serializableJsonObjectSchema.default({}),
});
export const projectCreateRequestSchema = createProjectInputSchema
  .omit({ initial_workspace: true })
  .extend({ initialWorkspace: initialWorkspaceRequestSchema });
export const projectUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    defaultAgentId: z.string().min(1).nullable().optional(),
    defaultAgentModel: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided" });
export type InitialWorkspaceRequest = z.infer<typeof initialWorkspaceRequestSchema>;
export type ProjectCreateRequest = z.input<typeof projectCreateRequestSchema>;
export type ProjectUpdateRequest = z.infer<typeof projectUpdateRequestSchema>;
