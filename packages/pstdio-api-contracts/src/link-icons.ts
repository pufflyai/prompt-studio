import { z } from "zod";

// The icon is inlined as a data URL because the dashboard can only load images from its own origin.
export const linkIconSchema = z.object({
  data_url: z.string(),
});

export type LinkIcon = z.infer<typeof linkIconSchema>;
