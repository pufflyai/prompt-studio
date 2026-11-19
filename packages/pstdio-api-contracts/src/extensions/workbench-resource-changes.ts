import { z } from "zod";

export const resourceChangeProviderMetadataSchema = z.object({
  extensionId: z.string(),
  type: z.string(),
  refreshEvents: z.array(z.string()),
});
