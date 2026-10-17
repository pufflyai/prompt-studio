import { z } from "zod";
import { extensionPanelRegions } from "../extension-kernel/types/composition";
import { extensionResourceRefSchema } from "./resource-ref";

export const relatedResourceOpeningSchema = z.object({
  resource: extensionResourceRefSchema,
  autoOpen: z.boolean().optional(),
  region: z.enum(extensionPanelRegions),
  open: z.enum(["preview", "pin"]).optional(),
});
