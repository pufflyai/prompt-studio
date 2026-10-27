import { z } from "zod";
import { nativeDocumentTargetSchema, nativeFileContentSchema } from "./native-document-schemas";

export const nativeDocumentOpenSchema = nativeDocumentTargetSchema
  .extend({
    sourceState: z.base64().optional(),
    pendingUpdate: z.base64().optional(),
  })
  .refine((value) => value.pendingUpdate === undefined || value.sourceState !== undefined, {
    message: "Pending editor frames need their original history",
  });
export const nativeDocumentFrameSchema = z.strictObject({ roomId: z.uuid(), update: z.base64() });
export const nativeDocumentSnapshotSchema = z.object({
  state: z.base64(),
  seedId: z.string(),
  sourceSeedId: z.string(),
  sourceState: z.base64().optional(),
});
export const nativeDocumentJoinedSchema = nativeDocumentSnapshotSchema.extend({
  roomId: z.uuid(),
  documentKey: z.string(),
  content: nativeFileContentSchema,
});
export type NativeDocumentSnapshot = z.infer<typeof nativeDocumentSnapshotSchema>;
export type NativeDocumentJoined = z.infer<typeof nativeDocumentJoinedSchema>;
