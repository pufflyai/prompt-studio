import { z } from "zod";
import { type createRecoveryChunkStore, recoveryChunkSchema } from "./chunks";

export const recoveryManifestSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("folder-capture"),
  projectId: z.string().min(1),
  accountId: z.string().min(1),
  source: z.strictObject({
    id: z.string().min(1).max(256),
    deviceId: z.string().min(1).max(256),
    name: z.string().min(1).max(1024),
    folder: z.string().min(1),
  }),
  capture: z.strictObject({
    inventory: recoveryChunkSchema,
    exclusions: recoveryChunkSchema.nullable(),
    policy: z.string().nullable(),
    rootMode: z.number().int().min(0).max(0o7777),
    files: z.number().int().nonnegative().safe(),
    bytes: z.number().int().nonnegative().safe(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
  }),
});
export type RecoveryManifest = z.infer<typeof recoveryManifestSchema>;
export type RecoveryChunkStore = Awaited<ReturnType<typeof createRecoveryChunkStore>>;

export const readRecoveryManifest = async (
  chunks: RecoveryChunkStore,
  reference: Parameters<RecoveryChunkStore["read"]>[0],
) => {
  const value = recoveryManifestSchema.parse(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await chunks.read(reference))),
  );
  if (value.projectId !== chunks.space.projectId || value.accountId !== chunks.space.spaceOwner)
    throw new Error("Recovery capture belongs to another private project space");
  if (value.capture.completedAt < value.capture.startedAt) throw new Error("Invalid recovery capture interval");
  return value;
};
