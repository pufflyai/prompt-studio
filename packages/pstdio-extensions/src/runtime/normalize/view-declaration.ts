import { controlValuesSchema, localizableStringSchema, packageAssetDescriptorSchema } from "pstdio-api-contracts";
import { z } from "zod";
import { callbackSchema } from "./composition-declarations";
import { localRefSchema } from "./navigation-declaration";

const native = {
  refreshEvents: z.array(z.union([z.string().regex(/\./), localRefSchema("event")])).optional(),
  emptyTitle: localizableStringSchema.optional(),
  emptyDescription: localizableStringSchema.optional(),
};
const body = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("controls"),
      ...native,
      query: callbackSchema,
      onValueChange: callbackSchema.optional(),
      onApply: callbackSchema.optional(),
      onReset: callbackSchema.optional(),
      defaultValues: controlValuesSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("file"), ...native, load: callbackSchema, save: callbackSchema.optional() }).strict(),
  z
    .object({
      kind: z.literal("tree"),
      ...native,
      body: callbackSchema,
      header: callbackSchema.optional(),
      footer: callbackSchema.optional(),
      children: callbackSchema.optional(),
      searchable: z.boolean().optional(),
      searchPlaceholder: localizableStringSchema.optional(),
      defaultExpandedSectionIds: z.array(z.string()).optional(),
      defaultExpandedNodeIds: z.array(z.string()).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dataTable"),
      ...native,
      query: callbackSchema,
      onRowActivate: callbackSchema.optional(),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal("kanban"),
      ...native,
      query: callbackSchema,
      onAttributeChange: callbackSchema.optional(),
      onReorder: callbackSchema.optional(),
      onColumnAction: callbackSchema.optional(),
      onRowActivate: callbackSchema.optional(),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal("webview"),
      entry: packageAssetDescriptorSchema,
      title: localizableStringSchema.optional(),
      capabilities: z.array(z.string()).optional(),
    })
    .strict(),
]);
export const viewDeclarationSchema = z
  .object({
    id: z.string(),
    ref: localRefSchema("view"),
    title: localizableStringSchema,
    icon: z.string().optional(),
    body,
  })
  .strict();
