import { z } from "zod";
import { localizableStringSchema } from "./common";

export const workbenchExtensionConnectionRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  label: localizableStringSchema,
  authType: z.enum(["bearer", "header"]),
  supportsCheck: z.boolean(),
});

export const extensionConnectionRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  connectionId: z.string(),
  baseUrl: z.string(),
  authType: z.enum(["bearer", "header"]),
  configured: z.boolean(),
  lastCheck: z
    .object({
      ok: z.boolean(),
      status: z.number().int().nullable(),
      error: z.string().nullable(),
      checkedAt: z.string(),
    })
    .nullable(),
  updatedAt: z.string(),
});

export const configureExtensionConnectionSchema = z.object({
  baseUrl: z.url(),
  secret: z.string().optional(),
});

export const listExtensionConnectionsResponseSchema = z.object({
  connections: z.array(extensionConnectionRecordSchema),
});

export type ExtensionConnectionRecord = z.infer<typeof extensionConnectionRecordSchema>;
export type ConfigureExtensionConnectionInput = z.infer<typeof configureExtensionConnectionSchema>;
export type ListExtensionConnectionsResponse = z.infer<typeof listExtensionConnectionsResponseSchema>;
