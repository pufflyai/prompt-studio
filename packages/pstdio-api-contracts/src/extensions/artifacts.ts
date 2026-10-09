import { z } from "zod";
import { localizableStringSchema } from "./common";

export const extensionArtifactMountSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  relativePath: z.string(),
  fullPath: z.string(),
  label: localizableStringSchema,
  watch: z.boolean(),
});

export type ExtensionArtifactMount = z.infer<typeof extensionArtifactMountSchema>;
