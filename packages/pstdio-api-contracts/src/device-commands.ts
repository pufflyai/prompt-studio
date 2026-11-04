import { z } from "zod";
import { approvalInputSchema, sessionCreateRequestSchema, sessionFollowUpRequestSchema } from "./sessions";
import { extensionWorkspaceCreateInputSchema } from "./workspaces";

const id = z.string().min(1);
const commandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("session.removeUnsubmittedAttachment"), projectId: id, fileId: z.string().uuid() }),
  z.strictObject({
    type: z.literal("session.copyAttachment"),
    projectId: id,
    fileId: z.string().uuid(),
    name: z.string().min(1),
    mimeType: z.string().nullable(),
    data: z.string(),
  }),
  z.strictObject({
    type: z.literal("session.create"),
    input: sessionCreateRequestSchema.omit({ deviceId: true }).strict(),
  }),
  z.strictObject({ type: z.literal("session.followUp"), id, input: sessionFollowUpRequestSchema.strict() }),
  z.strictObject({ type: z.literal("session.approve"), id, input: approvalInputSchema.strict() }),
  z.strictObject({ type: z.literal("session.interrupt"), id }),
  z.strictObject({
    type: z.literal("workspace.create"),
    input: extensionWorkspaceCreateInputSchema.omit({ deviceId: true }).strict(),
  }),
  z.strictObject({
    type: z.literal("workspace.listFiles"),
    id,
    path: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().max(500).optional(),
  }),
  z.strictObject({ type: z.literal("workspace.readFile"), id, path: z.string().min(1) }),
  z.strictObject({ type: z.literal("workspace.diff"), id, mode: z.enum(["current", "fork_point"]).optional() }),
  z.strictObject({ type: z.literal("workspace.diffFiles"), id, mode: z.enum(["current", "fork_point"]).optional() }),
  z.strictObject({ type: z.literal("workspace.diffSummary"), id, mode: z.enum(["current", "fork_point"]).optional() }),
  z.strictObject({
    type: z.literal("workspace.diffFile"),
    id,
    path: z.string(),
    mode: z.enum(["current", "fork_point"]).optional(),
  }),
]);
export type DeviceCommand = z.infer<typeof commandSchema>;
export const deviceCommandSchema: z.ZodType<DeviceCommand> = commandSchema;
export const deviceCommandResultSchema = z.strictObject({
  status: z.number().int().min(200).max(599),
  body: z.unknown(),
});
