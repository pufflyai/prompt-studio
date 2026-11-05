import { z } from "zod";
import { harnessCommandStateSchema, harnessModeSchema, harnessOperationSchema } from "../harness-commands";
import { sessionMessageSchema } from "../session-messages";
import { questionResponseSchema } from "../sessions";
import { controlParamSchema, controlValuesSchema } from "./control-declarations";

export const chatLinkCandidateSchema = z.strictObject({
  source: z.string(),
  origin: z.enum(["markdown", "inline-code", "reference", "tool", "text"]),
});
export const chatLinkPresentationSchema = z
  .strictObject({
    href: z.string().nullable(),
    label: z.string().optional(),
    icon: z.string().optional(),
  })
  .nullable();
export type ChatLinkCandidate = z.infer<typeof chatLinkCandidateSchema>;
export type ChatLinkPresentation = z.infer<typeof chatLinkPresentationSchema>;

export const chatAttachmentSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  size: z.number().nonnegative().optional(),
  mediaType: z.string().optional(),
  url: z.string().optional(),
});
export const chatQueuedRequestSchema = z.strictObject({
  id: z.string().min(1),
  prompt: z.string(),
  /** Saved control values for editing this request; keys belong to the provider. */
  values: controlValuesSchema.optional(),
  position: z.number().int().nonnegative().optional(),
  revision: z.string().optional(),
  model: z.string().nullable().optional(),
  params: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  attachments: z.array(chatAttachmentSchema).optional(),
  /** Run captured when the queue selection was presented, used for stale-run guards. */
  activeRunStartedAt: z.string().nullable().optional(),
  steeringUnavailableReason: z.string().nullable().optional(),
  steeringDelivery: z.object({ id: z.string(), runStartedAt: z.string() }).nullable().optional(),
  sending: z.boolean().optional(),
});
const chatDraftContentSchema = z.strictObject({
  text: z.string(),
  attachments: z.array(chatAttachmentSchema),
  values: controlValuesSchema,
});
export const chatDraftSchema = chatDraftContentSchema.extend({
  /** Unsent drafts recovered after editing raced an asynchronous read. */
  recovered: z.array(chatDraftContentSchema).optional(),
});
const chatInputTagSchema = z.object({
  label: z.string(),
  description: z.string(),
  clearActionId: z.string(),
  closeLabel: z.string().optional(),
});
/** Public wire messages retain the existing session protocol; no second transcript format. */
export const chatRendererSnapshotSchema = z.strictObject({
  messages: z.array(sessionMessageSchema).optional(),
  queuedFollowUps: z.array(chatQueuedRequestSchema).optional(),
  controls: z.array(controlParamSchema).optional(),
  values: controlValuesSchema.optional(),
  streaming: z.boolean().optional(),
  streamingStartedAt: z.number().optional(),
  readOnly: z.boolean().optional(),
  /** Disable queue edits independently while other execution controls remain usable. */
  queueReadOnly: z.boolean().optional(),
  submitDisabled: z.boolean().optional(),
  notice: z.string().optional(),
  /** Use the host's scoped workspace link/image resolver. */
  workspaceId: z.string().optional(),
  nativeLinks: z.boolean().optional(),
  /** Opt in to trusted host account UI and its dedicated authentication channel. */
  nativeHarnessAccount: z.object({ controlId: z.string().min(1), remote: z.boolean().optional() }).optional(),
  harness: harnessCommandStateSchema.optional(),
  draftTag: chatInputTagSchema.nullable().optional(),
  /** A submitted native input reference, distinct from any new tagged draft. Hiding it does not cancel work. */
  sentTag: chatInputTagSchema.nullable().optional(),
  decision: z
    .object({
      id: z.string(),
      model: z.string().optional(),
      modeSnapshot: harnessModeSchema.optional(),
      actions: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          variant: z.enum(["primary", "subtle", "ghost"]),
          disabled: z.boolean().optional(),
        }),
      ),
    })
    .nullable()
    .optional(),
  resources: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        additions: z.number().optional(),
        deletions: z.number().optional(),
      }),
    )
    .optional(),
  approval: z
    .object({ id: z.string(), title: z.string(), choices: z.array(z.object({ id: z.string(), label: z.string() })) })
    .nullable()
    .optional(),
  fork: z.object({ disabledReason: z.string().nullable() }).optional(),
  operations: z.array(z.object({ id: z.string(), label: z.string(), disabled: z.boolean().optional() })).optional(),
});
export const chatRendererActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("submit"),
    text: z.string(),
    attachments: z.array(chatAttachmentSchema),
    values: controlValuesSchema,
    questionResponse: questionResponseSchema.optional(),
  }),
  z.strictObject({ type: z.literal("stop") }),
  z.strictObject({ type: z.literal("fork"), messageId: z.string().min(1) }),
  z.strictObject({
    type: z.literal("harness"),
    operation: harnessOperationSchema,
    modeSnapshot: harnessModeSchema.optional(),
    values: controlValuesSchema.optional(),
  }),
  z.strictObject({ type: z.literal("selectCommand"), name: z.string(), values: controlValuesSchema.optional() }),
  z.strictObject({ type: z.literal("confirmation"), modeId: z.string(), values: controlValuesSchema.optional() }),
  z.strictObject({
    type: z.literal("decision"),
    id: z.string(),
    actionId: z.string(),
    values: controlValuesSchema.optional(),
    modeSnapshot: harnessModeSchema.optional(),
  }),
  z.strictObject({ type: z.literal("openResource"), id: z.string() }),
  z.strictObject({ type: z.literal("openLink"), candidate: chatLinkCandidateSchema }),
  z.strictObject({ type: z.literal("control"), id: z.string(), values: controlValuesSchema }),
  z.strictObject({ type: z.literal("approve"), id: z.string(), choice: z.string() }),
  z.strictObject({ type: z.literal("operation"), id: z.string(), values: controlValuesSchema }),
  z.strictObject({ type: z.literal("upload"), name: z.string(), mediaType: z.string(), data: z.string() }),
  z.strictObject({ type: z.literal("deleteAttachment"), id: z.string() }),
  z.strictObject({
    type: z.literal("queue"),
    operation: z.enum(["update", "create", "remove", "move", "combine", "steer"]),
    item: chatQueuedRequestSchema,
    target: chatQueuedRequestSchema.optional(),
    prompt: z.string().optional(),
    direction: z.enum(["up", "down"]).optional(),
    steps: z.number().int().positive().optional(),
    values: controlValuesSchema,
    attachments: z.array(chatAttachmentSchema),
  }),
]);
export const chatRendererActionResultSchema = z.strictObject({
  snapshot: chatRendererSnapshotSchema.optional(),
  attachment: chatAttachmentSchema.optional(),
  draft: chatDraftSchema.optional(),
});
/** A watch command writes versioned snapshots. Older/delayed reads never replace a newer stream revision. */
const revision = z.number().int().nonnegative();
export const chatRendererEventSchema = z.union([
  z.strictObject({ revision, snapshot: chatRendererSnapshotSchema }),
  /** Recover a failed asynchronous operation without overwriting newer composer work. */
  z.strictObject({ revision, recoverDraft: chatDraftSchema }),
  z.strictObject({
    revision,
    patch: z
      .strictObject({
        op: z.enum(["add", "replace", "remove"]),
        path: z.string().regex(/^\/messages(?:\/\d+)?$/),
        value: z.union([sessionMessageSchema, z.array(sessionMessageSchema)]).optional(),
      })
      .refine((patch) => {
        if (patch.op === "remove") return patch.path !== "/messages" && patch.value === undefined;
        if (patch.value === undefined) return false;
        return patch.path === "/messages" ? Array.isArray(patch.value) : !Array.isArray(patch.value);
      }, "Message patch value must match its operation and target."),
  }),
]);

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;
export type ChatQueuedRequest = z.infer<typeof chatQueuedRequestSchema>;
export type ChatDraft = z.infer<typeof chatDraftSchema>;
export type ChatRendererSnapshot = z.infer<typeof chatRendererSnapshotSchema>;
export type ChatRendererAction = z.infer<typeof chatRendererActionSchema>;
export type ChatRendererActionResult = z.infer<typeof chatRendererActionResultSchema>;
export type ChatRendererEvent = z.infer<typeof chatRendererEventSchema>;
