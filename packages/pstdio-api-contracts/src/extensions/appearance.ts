import { z } from "zod";
import { jsonObjectSchema, localizableStringSchema, packageAssetDescriptorSchema } from "./common";

export const extensionThemeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  description: localizableStringSchema.optional(),
  format: z.literal("vscode-color-theme"),
  mode: z.enum(["light", "dark"]),
  source: packageAssetDescriptorSchema,
  tokens: z.record(z.string(), z.string()),
  monacoTheme: z.object({
    base: z.enum(["vs", "vs-dark"]),
    inherit: z.literal(true),
    rules: z.array(z.record(z.string(), z.unknown())),
    colors: z.record(z.string(), z.string()),
  }),
});

export const extensionFileIconThemeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  description: localizableStringSchema.optional(),
  format: z.literal("vscode-file-icon-theme"),
  source: packageAssetDescriptorSchema,
  definitions: jsonObjectSchema,
  fileExtensions: z.record(z.string(), z.string()),
  fileNames: z.record(z.string(), z.string()),
  defaults: z.object({ file: z.string().optional(), folder: z.string().optional() }).default({}),
  fonts: z
    .array(
      z.object({
        fontFamily: z.string(),
        src: z.array(z.object({ url: z.string(), format: z.string().optional() })),
        weight: z.string().optional(),
        style: z.string().optional(),
      }),
    )
    .default([]),
});

export const extensionTranslationRecordSchema = z.object({
  extensionId: z.string(),
  defaultLocale: z.string(),
  bundles: z.record(z.string(), z.record(z.string(), z.string())),
});

export type ExtensionThemeRecord = z.infer<typeof extensionThemeRecordSchema>;
export type ExtensionFileIconThemeRecord = z.infer<typeof extensionFileIconThemeRecordSchema>;
export type ExtensionTranslationRecord = z.infer<typeof extensionTranslationRecordSchema>;
