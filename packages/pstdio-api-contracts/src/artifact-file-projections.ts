import { z } from "zod";

const location = { path: z.string(), parent: z.string() };
export const artifactFileNodeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...location, kind: z.literal("file"), updatedAt: z.string() }),
  z.strictObject({ ...location, kind: z.literal("directory"), id: z.string() }),
]);
export const artifactFileProjectionSchema = z.record(
  z.string(),
  z.strictObject({
    node: artifactFileNodeSchema.nullable(),
    hash: z.string().nullable(),
    revision: z.string(),
  }),
);
export type ArtifactFileNode = z.infer<typeof artifactFileNodeSchema>;
export type ArtifactFileProjection = z.infer<typeof artifactFileProjectionSchema>;
