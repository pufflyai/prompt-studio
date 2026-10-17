import { z } from "zod";
import { replaySchema } from "./replay";
import { checkpointSchema } from "./state";
import { assetSchema, fingerprintSchema, identitySchema, mutationSchema } from "./wire";

export const relayOperationSchema = z.enum([
  "initialize",
  "snapshot",
  "replay",
  "submit",
  "recover",
  "changes",
  "assets/begin",
  "assets/part",
  "assets/finish",
  "assets/cancel",
  "assets/read",
]);
export const relayRecoverySchema = z.strictObject({ mutation: mutationSchema, proof: fingerprintSchema });
const targetSchema = z.strictObject({ workbenchId: identitySchema, extensionId: identitySchema });
export type RelayTarget = z.infer<typeof targetSchema>;
export type RelayOperation = z.infer<typeof relayOperationSchema>;

// A prefix keeps even opaque '.' and '..' identities from becoming URL traversal segments.
export const relayPath = (target: RelayTarget, operation: RelayOperation) => {
  const { workbenchId, extensionId } = targetSchema.parse({
    workbenchId: target.workbenchId,
    extensionId: target.extensionId,
  });
  return `/v1/workbenches/~${encodeURIComponent(workbenchId)}/extensions/~${encodeURIComponent(extensionId)}/${relayOperationSchema.parse(operation)}`;
};
export const relayRoute = (pathname: string) => {
  const match = /^\/v1\/workbenches\/~([^/]+)\/extensions\/~([^/]+)\/(.+)$/.exec(pathname);
  if (!match) return null;
  try {
    return {
      ...targetSchema.parse({ workbenchId: decodeURIComponent(match[1]!), extensionId: decodeURIComponent(match[2]!) }),
      operation: relayOperationSchema.parse(match[3]),
    };
  } catch {
    return null;
  }
};
export const relayReplayResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("replay"), batch: replaySchema }),
  z.strictObject({ status: z.literal("snapshot-required"), checkpoint: checkpointSchema }),
]);
const byteLengthSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const relayAssetBeginSchema = z.strictObject({ uploadId: identitySchema, asset: assetSchema });
export const relayAssetUploadSchema = z.strictObject({ uploadId: identitySchema });
export const relayAssetPartSchema = z.strictObject({
  uploadId: identitySchema,
  number: z.number().int().min(1).max(10_000),
  sha256: fingerprintSchema,
  byteLength: byteLengthSchema,
});
export const relayAssetReadSchema = z
  .strictObject({ asset: assetSchema, offset: byteLengthSchema })
  .refine(({ asset, offset }) => offset <= asset.byteLength, "Offset exceeds the asset");
export const relayAssetStatusSchema = z.strictObject({
  asset: assetSchema,
  partSize: z.number().int().positive(),
  completed: z.boolean(),
  parts: z.array(
    z.strictObject({ number: z.number().int().positive(), sha256: fingerprintSchema, byteLength: byteLengthSchema }),
  ),
});
export const relayEventSchema = z.strictObject({ protocolVersion: z.literal(1), type: z.enum(["ready", "changed"]) });

export const relayInitializeSchema = z.strictObject({ publishedRevision: identitySchema });
