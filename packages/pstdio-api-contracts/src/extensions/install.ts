import { z } from "zod";
import { jsonObjectSchema } from "./common";

export const enableInstalledExtensionRequestSchema = z.object({
  displayName: z.string(),
  extensionId: z.string(),
  manifest: jsonObjectSchema,
  name: z.string(),
  sourceHash: z.string().nullable().optional(),
  sourceKind: z.enum(["local_path", "git", "registry"]),
  sourcePath: z.string(),
  sourceRef: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
});

export const enableInstalledExtensionResponseSchema = z.object({
  enabled: z.literal(true),
  installName: z.string(),
  installedExtensionId: z.string(),
  instanceId: z.string(),
  name: z.string(),
  projectId: z.string(),
});

export const projectExtensionInstanceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  extensionId: z.string(),
  installedExtensionId: z.string(),
  installName: z.string(),
  name: z.string(),
  displayName: z.string(),
  version: z.string().nullable().optional(),
  description: z.string().optional(),
  sourcePath: z.string(),
  scope: z.enum(["repo", "global"]),
  status: z.enum(["pending", "loaded", "error", "missing", "disabled"]),
  lastLoadedAt: z.string().nullable().optional(),
  lastError: jsonObjectSchema.nullable().optional(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  /** New source is waiting in the extensions root. The project keeps running the adopted version until a person takes it. */
  updateAvailable: z.boolean(),
});

export const listProjectExtensionsResponseSchema = z.object({
  extensions: z.array(projectExtensionInstanceSchema),
});

export const setProjectExtensionEnabledRequestSchema = z.object({
  enabled: z.boolean(),
});

export const setExtensionAutomationEnabledRequestSchema = z.object({
  enabled: z.boolean(),
});

export const attemptExtensionFixResponseSchema = z.object({
  sessionId: z.string(),
  title: z.string(),
});

export const updateInstalledExtensionTemplateInputSchema = z.object({
  content: z.string().min(1),
});

export const updateInstalledExtensionTemplateResponseSchema = z.object({
  installName: z.string(),
  key: z.string(),
  content: z.string(),
});

export const setupProjectExtensionResponseSchema = z.object({
  extensionId: z.string(),
  name: z.string(),
  installName: z.string(),
  installedSkills: z.array(
    z.object({
      id: z.string(),
      extensionId: z.string(),
      skillKey: z.string(),
      installedAgents: z.array(z.string()),
    }),
  ),
});

export type EnableInstalledExtensionRequest = z.infer<typeof enableInstalledExtensionRequestSchema>;
export type EnableInstalledExtensionResponse = z.infer<typeof enableInstalledExtensionResponseSchema>;
export type ProjectExtensionInstance = z.infer<typeof projectExtensionInstanceSchema>;
export type ListProjectExtensionsResponse = z.infer<typeof listProjectExtensionsResponseSchema>;
export type SetProjectExtensionEnabledRequest = z.infer<typeof setProjectExtensionEnabledRequestSchema>;
export type SetExtensionAutomationEnabledRequest = z.infer<typeof setExtensionAutomationEnabledRequestSchema>;
export type AttemptExtensionFixResponse = z.infer<typeof attemptExtensionFixResponseSchema>;
export type UpdateInstalledExtensionTemplateInput = z.infer<typeof updateInstalledExtensionTemplateInputSchema>;
export type UpdateInstalledExtensionTemplateResponse = z.infer<typeof updateInstalledExtensionTemplateResponseSchema>;
export type SetupProjectExtensionResponse = z.infer<typeof setupProjectExtensionResponseSchema>;
