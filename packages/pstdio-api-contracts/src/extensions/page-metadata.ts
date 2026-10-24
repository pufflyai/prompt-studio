import { z } from "zod";
import { localizableStringSchema } from "./common";
import { navigationTargetSchema } from "./navigation-target-metadata";
import { pageParamDefinitionsSchema } from "./page-params-schema";
import { createPagePlaceholderBreadcrumbSchema } from "./page-placeholder-schema";
import { workbenchPlacementPresentationSchema } from "./placement-metadata";
import { placementItemSchema, resourceConstraintSchema } from "./resource-binding-metadata";
import { modeRefSchema, pageRefSchema, placementRefSchema, viewRefSchema } from "./workbench-refs-metadata";

export { pageRefSchema, pageSlotRefSchema, panelRefSchema, placementRefSchema } from "./workbench-refs-metadata";

const emptySchema = z.union([
  viewRefSchema,
  z
    .object({
      view: viewRefSchema,
      breadcrumb: createPagePlaceholderBreadcrumbSchema(navigationTargetSchema).optional(),
    })
    .strict(),
]);

const mainSchema = z.discriminatedUnion("kind", [
  workbenchPlacementPresentationSchema
    .extend({
      kind: z.literal("view"),
      view: viewRefSchema,
      cardinality: z.enum(["one", "many"]),
      presentation: z.enum(["page", "tabs"]).optional(),
      empty: emptySchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("panels"),
      empty: emptySchema.optional(),
      landing: z.union([z.string(), placementRefSchema]).optional(),
    })
    .strict(),
]);
const slotSchema = workbenchPlacementPresentationSchema
  .extend({
    id: z.string(),
    region: z.enum(["main", "secondary", "side"]),
    addableIn: z.array(z.enum(["main", "secondary", "side"])).optional(),
    movableTo: z.array(z.enum(["main", "secondary", "side"])).optional(),
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
  regionSettings: z
    .object({
      main: z.object({ showHeader: z.boolean().optional() }).optional(),
      side: z.object({ showHeader: z.boolean().optional() }).optional(),
      secondary: z.object({ showHeader: z.boolean().optional() }).optional(),
    })
    .optional(),
  document: z.object({ metadataKey: z.string().refine((key) => key.trim().length > 0) }).optional(),
  mode: modeRefSchema,
  parent: pageRefSchema.optional(),
  resource: resourceConstraintSchema.optional(),
  main: mainSchema,
  panelView: placementRefSchema.optional(),
  slots: z.array(slotSchema),
});
