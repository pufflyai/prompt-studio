import { z } from "zod";
import { extensionsCheckResponseSchema } from "./check";
import { projectExtensionInstanceSchema } from "./install";

const installNameSchema = z
  .string()
  .min(1)
  .refine(
    (name) => name !== "." && name !== ".." && !/[\\/:]/.test(name) && name.trim().length > 0,
    "Install name must be one folder name.",
  );

export const installExtensionRequestSchema = z
  .object({
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("catalog"), name: z.string().min(1), ref: z.string().min(1).optional() }).strict(),
      z
        .object({ kind: z.literal("project-folder"), path: z.string().min(1), development: z.boolean().optional() })
        .strict(),
    ]),
    installName: installNameSchema.optional(),
    force: z.boolean().optional(),
    skipInstall: z.boolean().optional(),
  })
  .strict();

const formBoolean = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const uploadExtensionRequestSchema = z
  .object({
    kind: z.literal("upload"),
    installName: installNameSchema.optional(),
    folderName: installNameSchema,
    files: z.preprocess(
      (value) => (Array.isArray(value) ? value : [value]),
      z.array(z.instanceof(File).meta({ type: "string", format: "binary" })).min(1),
    ),
    force: formBoolean,
    skipInstall: formBoolean,
    development: formBoolean,
  })
  .strict();

export const installedExtensionSourceSchema = z.object({
  check: extensionsCheckResponseSchema,
  installName: z.string(),
  manifest: z.record(z.string(), z.unknown()),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string(),
    version: z.string(),
    description: z.string().optional(),
    enginesPstdio: z.string(),
  }),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("local"), path: z.string(), ref: z.string().optional() }),
    z.object({ kind: z.literal("named"), name: z.string(), ref: z.string() }),
  ]),
  sourceHash: z.string(),
  targetPath: z.string(),
});
export const installExtensionResponseSchema = z.object({
  source: installedExtensionSourceSchema,
  extension: projectExtensionInstanceSchema,
});
export const extensionDiagnosticsResponseSchema = z.object({
  roots: z.array(
    z.object({
      scope: z.enum(["repo", "user"]),
      path: z.string(),
      check: extensionsCheckResponseSchema,
    }),
  ),
});
export type InstallExtensionRequest = z.infer<typeof installExtensionRequestSchema>;
export type UploadExtensionRequest = z.infer<typeof uploadExtensionRequestSchema>;
export type InstallExtensionResponse = z.infer<typeof installExtensionResponseSchema>;
export type InstalledExtensionSource = z.infer<typeof installedExtensionSourceSchema>;
export type ExtensionDiagnosticsResponse = z.infer<typeof extensionDiagnosticsResponseSchema>;
