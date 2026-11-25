import { z } from "zod";
import { upgradeProjectExtensionResponseSchema } from "./install";

const resolutionPath = z.string().min(1).max(4096);
const reviewId = z.uuid();

export const extensionUpgradeReviewResolutionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("local"), path: resolutionPath }),
  z.strictObject({ kind: z.literal("incoming"), path: resolutionPath }),
  z.strictObject({ kind: z.literal("text"), path: resolutionPath, text: z.string().max(1024 * 1024) }),
]);

export const extensionUpgradeAgentProposalSchema = z.object({
  reviewId,
  revision: z.string(),
  resolutions: z.array(extensionUpgradeReviewResolutionSchema).max(20_000),
});

export const staleExtensionUpgradeReviewDetailsSchema = z.object({ changedPaths: z.array(resolutionPath) });

export const extensionUpgradeReviewSchema = z.object({
  id: reviewId,
  incomingVersion: z.string(),
  hasOriginal: z.boolean(),
  separateLocalProvider: z.boolean(),
  localPath: z.string(),
  createdAt: z.string(),
  revision: z.string(),
  changedPaths: staleExtensionUpgradeReviewDetailsSchema.shape.changedPaths.optional(),
  resolutions: z.array(extensionUpgradeReviewResolutionSchema),
  previousResolutions: z.array(extensionUpgradeReviewResolutionSchema).optional(),
  changes: z.array(
    z.object({
      path: resolutionPath,
      status: z.enum(["local", "incoming", "merged", "conflict"]),
      localKind: z.enum(["file", "link", "directory"]).nullable(),
      incomingKind: z.enum(["file", "link", "directory"]).nullable(),
    }),
  ),
});

export const extensionUpgradeReviewFileSchema = z.object({
  base: z.string().nullable(),
  local: z.string().nullable(),
  incoming: z.string().nullable(),
  proposed: z.string().nullable(),
});

export const extensionUpgradeReviewRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("begin") }),
  z.strictObject({ action: z.literal("read"), id: reviewId }),
  z.strictObject({ action: z.literal("file"), id: reviewId, path: resolutionPath, revision: z.string().optional() }),
  z.strictObject({
    action: z.literal("refresh"),
    id: reviewId,
    revision: z.string(),
    resolutions: z.array(extensionUpgradeReviewResolutionSchema).max(20_000).optional(),
  }),
  z.strictObject({
    action: z.literal("save"),
    id: reviewId,
    revision: z.string(),
    resolutions: z.array(extensionUpgradeReviewResolutionSchema).max(20_000),
  }),
  z.strictObject({
    action: z.literal("validate"),
    id: reviewId,
    revision: z.string(),
    resolutions: z.array(extensionUpgradeReviewResolutionSchema).max(20_000),
  }),
  z.strictObject({ action: z.literal("cancel"), id: reviewId }),
  z.strictObject({
    action: z.literal("apply"),
    id: reviewId,
    resolutions: z.array(extensionUpgradeReviewResolutionSchema).max(20_000),
    usePublished: z.boolean().optional(),
    revision: z.string(),
  }),
]);

export const extensionUpgradeReviewResponseSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin"), review: extensionUpgradeReviewSchema }),
  z.object({ action: z.literal("read"), review: extensionUpgradeReviewSchema }),
  z.object({ action: z.literal("refresh"), review: extensionUpgradeReviewSchema }),
  z.object({ action: z.literal("file"), file: extensionUpgradeReviewFileSchema }),
  z.object({ action: z.literal("save"), review: extensionUpgradeReviewSchema }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("validate"), valid: z.literal(true), revision: z.string() }),
  z.object({ action: z.literal("apply"), upgrade: upgradeProjectExtensionResponseSchema }),
]);

export type ExtensionUpgradeReviewResolution = z.infer<typeof extensionUpgradeReviewResolutionSchema>;
export type ExtensionUpgradeReview = z.infer<typeof extensionUpgradeReviewSchema>;
export type ExtensionUpgradeReviewFile = z.infer<typeof extensionUpgradeReviewFileSchema>;
export type ExtensionUpgradeReviewRequest = z.infer<typeof extensionUpgradeReviewRequestSchema>;
export type ExtensionUpgradeReviewResponse = z.infer<typeof extensionUpgradeReviewResponseSchema>;
