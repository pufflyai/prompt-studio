import { z } from "zod";
import { localizableStringSchema } from "./common";
import { navigationTargetSchema } from "./navigation-target-metadata";
import { placementPresenceSchema, workbenchPlacementPresentationSchema } from "./placement-metadata";
import { modeRefSchema, pageRefSchema, resourceKindRefSchema, viewRefSchema } from "./workbench-refs-metadata";

export { pageRefSchema, pageSlotRefSchema, panelRefSchema, placementRefSchema } from "./workbench-refs-metadata";

const bindingSchema = z.object({
  kind: z.union([resourceKindRefSchema, z.array(resourceKindRefSchema)]),
  view: viewRefSchema,
  cardinality: z.enum(["one", "many"]),
  add: navigationTargetSchema.optional(),
});

const slotBaseSchema = workbenchPlacementPresentationSchema.extend({
  id: z.string(),
  region: z.enum(["main", "secondary", "side"]),
  order: z.number().optional(),
});

const primarySlotSchema = slotBaseSchema.extend({
  role: z.literal("primary"),
  view: viewRefSchema.optional(),
  binding: bindingSchema.optional(),
});

const staticSlotSchema = slotBaseSchema.extend({
  role: z.literal("auxiliary"),
  view: viewRefSchema,
  presence: placementPresenceSchema,
});

const boundSlotSchema = slotBaseSchema.extend({
  role: z.literal("auxiliary"),
  binding: bindingSchema,
  openOn: z.literal("page-resource").optional(),
});

const slotSchema = z.union([primarySlotSchema, staticSlotSchema, boundSlotSchema]);

export const workbenchExtensionPageRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  path: z.string(),
  mode: modeRefSchema,
  parent: pageRefSchema.optional(),
  slots: z.array(slotSchema),
});
