import { z } from "zod";
import { localContributionIdPattern } from "./extension-kernel/contribution-id";
import { serializableJsonObjectSchema } from "./extensions/common";
import { pageParamValueSchema } from "./extensions/page-params-schema";
import { extensionResourceRefSchema } from "./extensions/resource-ref";
import { nativeDocumentSourceSchema } from "./native-document-source";

export const textDocumentRefSchema = z.strictObject({
  sourceId: z.string().regex(localContributionIdPattern),
  params: serializableJsonObjectSchema,
  resource: extensionResourceRefSchema.optional(),
});

export const nativeDocumentTargetSchema = z.strictObject({
  fileRendererId: z.string().min(1),
  resource: extensionResourceRefSchema.optional(),
  pageParams: z.record(z.string(), pageParamValueSchema).optional(),
});
export const textSourceTargetSchema = z.strictObject({
  extensionId: z.string().min(1),
  textDocument: textDocumentRefSchema,
});
export const nativeTextTargetSchema = z.union([nativeDocumentTargetSchema, textSourceTargetSchema]);

export const nativeFileContentSchema = z
  .object({
    documentSource: nativeDocumentSourceSchema.optional(),
    textDocument: textDocumentRefSchema.optional(),
    fileName: z.string().optional(),
    filePath: z.string().optional(),
    mimeType: z.string().optional(),
    content: z.string().optional(),
    dataUrl: z.string().optional(),
    placeholder: z.string().optional(),
    editable: z.boolean().optional(),
    textRenderer: z.enum(["automatic", "monaco"]).optional(),
    emptyState: z.object({ title: z.string(), description: z.string().optional() }).optional(),
    revision: z.string().optional(),
  })
  .passthrough();
