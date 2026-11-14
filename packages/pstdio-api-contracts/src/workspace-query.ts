import { z } from "zod";
import { pageQuerySchema } from "./pagination";
import { resourceLinkRefSchema } from "./resource-anchors";

export const workspaceQuerySchema = pageQuerySchema.extend({
  /** Match any selected resource in either link direction. An empty selection matches nothing. */
  anchors: z.array(resourceLinkRefSchema).max(100).optional(),
});
export type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;
