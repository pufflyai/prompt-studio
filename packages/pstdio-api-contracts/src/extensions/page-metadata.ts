import { z } from "zod";
import { localizableStringSchema } from "./common";
import { regionSettingsSchema, regionSizeSchema, workbenchPlacementPresentationSchema } from "./placement-metadata";
import { placementItemSchema, resourceConstraintSchema } from "./resource-binding-metadata";
import { modeRefSchema, pageRefSchema, viewRefSchema } from "./workbench-refs-metadata";

export { pageRefSchema, pageSlotRefSchema, panelRefSchema, placementRefSchema } from "./workbench-refs-metadata";

const mainSchema = z.discriminatedUnion("kind", [
  workbenchPlacementPresentationSchema
    .extend({
      kind: z.literal("view"),
      view: viewRefSchema,
      cardinality: z.enum(["one", "many"]),
    })
    .strict(),
  z.object({ kind: z.literal("panels"), empty: viewRefSchema }).strict(),
]);
const slotSchema = workbenchPlacementPresentationSchema
  .extend({
    id: z.string(),
    region: z.enum(["main", "secondary", "side", "bottom", "aside"]),
    order: z.number().optional(),
    item: placementItemSchema,
    openOn: z.literal("page-resource").optional(),
  })
  .strict();

const panelMenuSchema = z
  .object({
    view: viewRefSchema,
    size: regionSizeSchema.strict().optional(),
    collapsible: z.boolean().optional(),
    hiddenByDefault: z.boolean().optional(),
  })
  .strict();

export const workbenchExtensionPageRecordSchema = z
  .object({
    id: z.string(),
    localId: z.string(),
    extensionId: z.string(),
    title: localizableStringSchema,
    icon: z.string().optional(),
    path: z.string(),
    document: z.object({ metadataKey: z.string().refine((key) => key.trim().length > 0) }).optional(),
    mode: modeRefSchema,
    modes: z.array(modeRefSchema).min(1).optional(),
    parent: pageRefSchema.optional(),
    resource: resourceConstraintSchema.optional(),
    main: mainSchema,
    panelMenus: z.object({ left: panelMenuSchema.optional(), right: panelMenuSchema.optional() }).strict().optional(),
    regionSettings: z
      .object({
        main: regionSettingsSchema.pick({ showHeader: true }).strict().optional(),
        bottom: regionSettingsSchema.strict().optional(),
        aside: regionSettingsSchema.strict().optional(),
      })
      .strict()
      .optional(),
    slots: z.array(slotSchema),
  })
  .superRefine((page, ctx) => {
    if (!page.modes) return;
    const key = (ref: typeof page.mode) => `${ref.extensionId}:${ref.id}`;
    const modes = page.modes.map(key);
    if (new Set(modes).size !== modes.length || !modes.includes(key(page.mode)))
      ctx.addIssue({ code: "custom", path: ["modes"], message: "Modes must be unique and include mode" });
  });
