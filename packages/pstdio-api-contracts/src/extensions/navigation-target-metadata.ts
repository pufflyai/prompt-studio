import { z } from "zod";
import { jsonObjectSchema } from "./common";
import { extensionResourceRefSchema } from "./execute";
import { pageRefSchema, panelRefSchema } from "./page-metadata";

const contributionRefSchema = <Kind extends string>(kind: Kind) =>
  z.object({ extensionId: z.string(), kind: z.literal(kind), id: z.string() });

const commandTargetSchema = z.object({
  command: contributionRefSchema("command"),
  params: jsonObjectSchema.optional(),
});

const sectionSchema = z.object({
  anchors: z.array(
    z.object({ id: z.string(), heading: z.string(), occurrence: z.number().int().nonnegative().optional() }),
  ),
});

interface MetadataPageTarget {
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

const navigationTargetItemSchema = z.union([
  pageTargetSchema,
  z.object({
    kind: z.literal("panel"),
    panel: panelRefSchema,
    resource: extensionResourceRefSchema.optional(),
    open: z.enum(["preview", "pin"]).optional(),
  }),
  z.object({
    kind: z.literal("view"),
    view: contributionRefSchema("view"),
    input: z
      .object({ strategy: z.enum(["persistent", "preview", "replace-active", "replace-invoking"]).optional() })
      .optional(),
  }),
  z.object({
    kind: z.literal("resource"),
    resource: extensionResourceRefSchema,
    input: z.object({ strategy: z.enum(["persistent", "replace-active"]).optional() }).optional(),
    section: sectionSchema.optional(),
  }),
  z.object({ kind: z.literal("command"), target: commandTargetSchema }),
  z.object({ kind: z.literal("href"), href: z.string() }),
]);

export const navigationTargetSchema = z.union([
  navigationTargetItemSchema,
  z.object({ kind: z.literal("compound"), targets: z.array(navigationTargetItemSchema).min(1) }),
]);
