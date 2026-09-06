import { z } from "zod";
import { extensionResourceRefSchema } from "./execute";
import { commandTargetSchema, pageRefSchema, panelRefSchema } from "./workbench-refs-metadata";

const sectionSchema = z.object({
  anchors: z.array(
    z.object({ id: z.string(), heading: z.string(), occurrence: z.number().int().nonnegative().optional() }),
  ),
});

export interface MetadataPageTarget {
  kind: "page";
  page: z.infer<typeof pageRefSchema>;
  resource?: z.infer<typeof extensionResourceRefSchema>;
  open?: "preview" | "pin";
  section?: z.infer<typeof sectionSchema>;
  parent?: MetadataPageTarget;
}

const pageTargetSchema: z.ZodType<MetadataPageTarget> = z
  .lazy(() =>
    z.object({
      kind: z.literal("page"),
      page: pageRefSchema,
      resource: extensionResourceRefSchema.optional(),
      open: z.enum(["preview", "pin"]).optional(),
      section: sectionSchema.optional(),
      parent: pageTargetSchema.optional(),
    }),
  )
  .meta({ id: "WorkbenchMetadataPageTarget" });

const navigationOperationSchema = z.union([
  pageTargetSchema,
  z.object({
    kind: z.literal("panel"),
    panel: panelRefSchema,
    resource: extensionResourceRefSchema.optional(),
    open: z.enum(["preview", "pin"]).optional(),
  }),
]);

export const navigationTargetSchema = z.union([
  navigationOperationSchema,
  z.object({ kind: z.literal("command"), target: commandTargetSchema }),
  z.object({ kind: z.literal("href"), href: z.string() }),
  z.object({ kind: z.literal("compound"), targets: z.array(navigationOperationSchema).min(1) }),
]);
