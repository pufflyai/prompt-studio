import { z } from "zod";
import { resourceLinkRefSchema } from "./resource-anchors";

export const resourceActivityCapabilitiesSchema = z.object({
  comments: z.boolean().optional(),
  changes: z.boolean().optional(),
  outcomes: z.boolean().optional(),
});
export const activityAuthorSchema = z.object({
  type: z.enum(["user", "agent", "system"]),
  id: z.string(),
  name: z.string(),
  extensionId: z.string().optional(),
});
export const activityRevisionSchema = z.object({
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1),
  headSha: z.string().regex(/^[a-f0-9]{40,64}$/),
  baseSha: z
    .string()
    .regex(/^[a-f0-9]{40,64}$/)
    .optional(),
  revision: z.number().int().nonnegative(),
  attemptId: z.string().optional(),
});
export const activityValidationSchema = z.object({ command: z.string(), result: z.string() });
export const activityFindingSchema = z.object({
  severity: z.enum(["critical", "minor", "suggestion"]),
  body: z.string().min(1),
  path: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  side: z.enum(["base", "head"]).optional(),
});
export const activityAttachmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  sha256: z.string(),
});
export const activityChangeSchema = z.object({
  field: z.string(),
  label: z.string().optional(),
  before: z.unknown(),
  after: z.unknown(),
  beforeLabel: z.string().optional(),
  afterLabel: z.string().optional(),
});
export const historicalResourceActivitySchema = z
  .object({
    /** Retry with the same key and content after a lost response. */
    key: z.string().min(1).max(200),
    kind: z.enum(["comment", "change", "implementation", "review"]),
    body: z.string(),
    replyToId: z.string().optional(),
    quote: z.string().max(10000).optional(),
    attachmentIds: z.array(z.string()).optional(),
    revision: activityRevisionSchema.optional(),
    implementationId: z.string().optional(),
    verdict: z.enum(["passed", "changes_requested"]).optional(),
    validation: z.array(activityValidationSchema).optional(),
    findings: z.array(activityFindingSchema).optional(),
    changes: z.array(activityChangeSchema).optional(),
    unfinished: z.string().optional(),
    shortcuts: z.string().optional(),
    blockers: z.string().optional(),
    target: z.object({ harnessId: z.string().min(1), modelId: z.string().min(1) }).optional(),
  })
  .superRefine((value, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if ((value.kind === "implementation" || value.kind === "review") && !value.revision)
      issue("Outcomes require exact revision context.");
    if (value.kind === "review" && (!value.verdict || !value.implementationId))
      issue("Reviews require a verdict and implementation entry.");
    if (value.kind !== "comment" && (value.replyToId || value.target))
      issue("Only comments can reply or hand off work.");
    if (
      value.kind === "review" &&
      value.verdict === "passed" &&
      value.findings?.some((finding) => finding.severity !== "suggestion")
    )
      issue("A passed review cannot contain unresolved findings.");
  });
export const publishResourceActivitySchema = historicalResourceActivitySchema.refine(
  (value) => value.body.trim().length > 0,
  { message: "Activity requires a nonempty body." },
);
export const resourceActivityEntrySchema = z.object({
  id: z.string(),
  resource: resourceLinkRefSchema.extend({ projectId: z.string(), extensionId: z.string() }),
  kind: z.enum(["comment", "change", "implementation", "review"]),
  body: z.string(),
  author: activityAuthorSchema,
  createdAt: z.string(),
  replyToId: z.string().optional(),
  quote: z.string().optional(),
  resolved: z.boolean(),
  attachments: z.array(activityAttachmentSchema),
  revision: activityRevisionSchema.optional(),
  implementationId: z.string().optional(),
  verdict: z.enum(["passed", "changes_requested"]).optional(),
  validation: z.array(activityValidationSchema).optional(),
  findings: z.array(activityFindingSchema).optional(),
  changes: z.array(activityChangeSchema).optional(),
  unfinished: z.string().optional(),
  shortcuts: z.string().optional(),
  blockers: z.string().optional(),
  target: z.object({ harnessId: z.string(), modelId: z.string() }).optional(),
  handoffDeviceId: z.string().optional(),
  origin: z.object({ resource: resourceLinkRefSchema, createdAt: z.string() }).optional(),
  sessionId: z.string().optional(),
  handoffError: z.string().optional(),
  legacy: z.object({ reportId: z.string(), shorthand: z.string().optional() }).optional(),
});
export const resourceActivityQuerySchema = z.object({
  resource: resourceLinkRefSchema,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const resourceActivityPageSchema = z.object({
  items: z.array(resourceActivityEntrySchema),
  nextCursor: z.string().nullable(),
  unresolved: z.number(),
});
export type ResourceActivityCapabilities = z.infer<typeof resourceActivityCapabilitiesSchema>;
export type ActivityAuthor = z.infer<typeof activityAuthorSchema>;
export type ActivityRevision = z.infer<typeof activityRevisionSchema>;
export type ResourceActivityEntry = z.infer<typeof resourceActivityEntrySchema>;
export type PublishResourceActivity = z.infer<typeof publishResourceActivitySchema>;
export type ResourceActivityAttachment = z.infer<typeof activityAttachmentSchema>;
export type ResourceActivityPage = z.infer<typeof resourceActivityPageSchema>;

export interface ResourceActivityImport {
  entry: PublishResourceActivity;
  author: ActivityAuthor;
  createdAt: string;
  source: import("./extension-kernel").ResourceRef;
}
