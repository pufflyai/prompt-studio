import { z } from "zod";
import { localizableStringSchema } from "./common";
import { pageParamDefinitionsSchema } from "./page-params-schema";
import { workbenchPlacementPresentationSchema } from "./placement-metadata";
import { placementItemSchema, resourceConstraintSchema } from "./resource-binding-metadata";
import { modeRefSchema, pageRefSchema, viewRefSchema } from "./workbench-refs-metadata";

export { pageRefSchema, pageSlotRefSchema, panelRefSchema, placementRefSchema } from "./workbench-refs-metadata";

const mainSchema = z.discriminatedUnion("kind", [
  workbenchPlacementPresentationSchema
    .extend({
      kind: z.literal("view"),
      view: viewRefSchema,
      cardinality: z.enum(["one", "many"]),
      closable: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal("panels"), empty: viewRefSchema }).strict(),
]);
const slotSchema = workbenchPlacementPresentationSchema
  .extend({
    id: z.string(),
    region: z.enum(["main", "secondary", "side"]),
    order: z.number().optional(),
    item: placementItemSchema,
    openOn: z.literal("page-resource").optional(),
  })
  .strict();

export const workbenchExtensionPageRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  path: z.string(),
  params: pageParamDefinitionsSchema.optional(),
  document: z.object({ metadataKey: z.string().refine((key) => key.trim().length > 0) }).optional(),
  mode: modeRefSchema,
  parent: pageRefSchema.optional(),
  resource: resourceConstraintSchema.optional(),
  main: mainSchema,
  slots: z.array(slotSchema),
});
