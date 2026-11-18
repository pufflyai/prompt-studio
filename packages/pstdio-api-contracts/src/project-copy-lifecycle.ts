import { identitySchema, projectDeletionStatusSchema, startProjectDeletionSchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const localCopyPresenceSchema = z.enum(["downloaded", "cloud-only", "removing", "downloading"]);

export const localRemovalPreflightSchema = z.strictObject({
  projectId: identitySchema,
  name: z.string(),
  uploadState: z.enum(["verified", "pending", "unknown"]),
  requiresDiscard: z.boolean(),
  removesManagedFolder: z.boolean(),
  providerWorkspaceCount: z.int().nonnegative(),
});

export const localRemovalConflictSchema = z.strictObject({
  code: z.literal("project_local_removal_discard_required"),
  error: z.string(),
  details: localRemovalPreflightSchema,
});

export const removeLocalProjectInputSchema = z.strictObject({ discardUnsynced: z.boolean().default(false) });
export const removeLocalProjectResultSchema = z.strictObject({
  projectId: identitySchema,
  presence: z.literal("cloud-only"),
});
export const downloadCloudProjectResultSchema = z.strictObject({
  projectId: identitySchema,
  presence: z.enum(["downloading", "downloaded"]),
});

export const deleteCloudProjectInputSchema = startProjectDeletionSchema;
export const cloudProjectDeletionSchema = projectDeletionStatusSchema.omit({ workbenchId: true }).extend({
  projectId: identitySchema,
});
export const cloudProjectCatalogEntrySchema = z.strictObject({
  id: identitySchema,
  name: z.string(),
  presence: localCopyPresenceSchema,
  online: z.boolean(),
  actions: z.strictObject({
    removeLocal: z.boolean(),
    download: z.boolean(),
    deleteCloud: z.boolean(),
  }),
});
export const cloudProjectCatalogSchema = z.strictObject({
  projects: z.array(cloudProjectCatalogEntrySchema),
  deletions: z.array(cloudProjectDeletionSchema.extend({ name: z.string() })),
});

export type LocalRemovalPreflight = z.infer<typeof localRemovalPreflightSchema>;
export type RemoveLocalProjectInput = z.input<typeof removeLocalProjectInputSchema>;
export type RemoveLocalProjectResult = z.infer<typeof removeLocalProjectResultSchema>;
export type DownloadCloudProjectResult = z.infer<typeof downloadCloudProjectResultSchema>;
export type DeleteCloudProjectInput = z.input<typeof deleteCloudProjectInputSchema>;
export type CloudProjectDeletion = z.infer<typeof cloudProjectDeletionSchema>;
export type CloudProjectCatalogEntry = z.infer<typeof cloudProjectCatalogEntrySchema>;
export type CloudProjectCatalog = z.infer<typeof cloudProjectCatalogSchema>;
