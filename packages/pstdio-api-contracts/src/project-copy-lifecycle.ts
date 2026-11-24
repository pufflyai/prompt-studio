import { identitySchema, projectDeletionStatusSchema, startProjectDeletionSchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const localCopyPresenceSchema = z.enum(["downloaded", "cloud-only", "removing", "downloading"]);

const projectCopyAccountSchema = z.strictObject({
  accountId: identitySchema,
  managerOrigin: z.string().min(1),
});
export type ProjectCopyAccount = z.infer<typeof projectCopyAccountSchema>;

const projectCopyDeviceSchema = projectCopyAccountSchema.extend({ deviceId: identitySchema });
/** An expectation for the signed-in device, independent of the project account. */
export type ProjectCopyDevice = z.infer<typeof projectCopyDeviceSchema>;

export const localRemovalPreflightSchema = z.strictObject({
  account: projectCopyAccountSchema.optional(),
  projectId: identitySchema,
  name: z.string(),
  uploadState: z.enum(["verified", "pending", "unknown"]),
  requiresDiscard: z.boolean(),
  removesManagedFolder: z.boolean(),
  retainsUnverifiedFolder: z.literal(true).optional(),
  providerWorkspaceCount: z.int().nonnegative(),
  providerWorkspaceNames: z.array(z.string()).optional(),
});

export const localRemovalConflictSchema = z.strictObject({
  code: z.literal("project_local_removal_discard_required"),
  error: z.string(),
  details: localRemovalPreflightSchema,
});

export const removeLocalProjectInputSchema = z.strictObject({
  discardUnsynced: z.boolean().default(false),
  expectedAccount: projectCopyAccountSchema.optional(),
  expectedDevice: projectCopyDeviceSchema.optional(),
});
export const removeLocalProjectResultSchema = z.strictObject({
  projectId: identitySchema,
  presence: z.literal("cloud-only"),
});
export const downloadCloudProjectResultSchema = z.strictObject({
  projectId: identitySchema,
  presence: z.enum(["downloading", "downloaded"]),
});

export const deleteCloudProjectInputSchema = startProjectDeletionSchema.extend({
  expectedAccount: projectCopyAccountSchema.optional(),
  expectedDevice: projectCopyDeviceSchema.optional(),
});
export const cloudProjectDeletionSchema = projectDeletionStatusSchema.omit({ workbenchId: true }).extend({
  projectId: identitySchema,
});
export const cloudProjectCatalogEntrySchema = z.strictObject({
  id: identitySchema,
  name: z.string(),
  presence: localCopyPresenceSchema,
  online: z.boolean(),
  downloadError: z.string().optional(),
  actions: z.strictObject({
    removeLocal: z.boolean(),
    download: z.boolean(),
    deleteCloud: z.boolean(),
  }),
});
export const cloudProjectCatalogSchema = z.strictObject({
  membershipKnown: z.boolean().optional(),
  account: projectCopyAccountSchema.optional(),
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
