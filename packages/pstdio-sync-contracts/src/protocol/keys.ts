import { z } from "zod";

// A space is a project or one user's personal space in it. Each key generation is 32 random bytes.
export const spaceKeySchema = z.strictObject({
  generation: z.number().int().positive(),
  secret: z.base64url().length(43),
});
// The account manager returns every generation, oldest first, so devices can read data sealed before a rotation.
export const spaceKeysSchema = z.strictObject({
  project: z.array(spaceKeySchema).min(1),
  personal: z.array(spaceKeySchema).min(1),
});
export const spaceKeysPath = (workbenchId: string) => `/v1/workbenches/${encodeURIComponent(workbenchId)}/keys`;

export type SpaceKey = z.infer<typeof spaceKeySchema>;
export type SpaceKeys = z.infer<typeof spaceKeysSchema>;
