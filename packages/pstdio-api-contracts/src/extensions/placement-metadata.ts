import { z } from "zod";

export const workbenchPlacementPresentationSchema = z.object({
  mountStrategy: z.enum(["active", "keep-mounted"]).optional(),
  hiddenByDefault: z.boolean().optional(),
  headerBorderBottom: z.boolean().optional(),
  floatingPanels: z.enum(["visible", "hidden"]).optional(),
  tab: z
    .object({
      queryHandlerId: z.string(),
      refreshEventIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export type WorkbenchPlacementPresentationRecord = z.infer<typeof workbenchPlacementPresentationSchema>;

export const placementPresenceSchema = z.enum(["fixed", "open", "closed"]);

export const regionSizeSchema = z.object({
  defaultPx: z.number().optional(),
  minPx: z.number().optional(),
  maxPx: z.number().optional(),
});

export const regionSettingsSchema = z.object({
  size: regionSizeSchema.optional(),
  collapsible: z.boolean().optional(),
  alwaysShowTabs: z.boolean().optional(),
});
