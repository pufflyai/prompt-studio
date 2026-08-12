import { z } from "zod";
import { extensionDiagnosticSchema } from "./common";

export const extensionHostCapabilitySchema = z.object({
  version: z.number().int().positive(),
  since: z.string().optional(),
});

export const extensionHostCapabilitiesSchema = z.object({
  host: z.literal("dashboard"),
  hostVersion: z.string(),
  capabilities: z.record(z.string(), extensionHostCapabilitySchema),
});

export const extensionHostCompatibilitySchema = z.object({
  status: z.enum(["verified", "unverified"]),
  host: extensionHostCapabilitiesSchema.optional(),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type ExtensionHostCapability = z.infer<typeof extensionHostCapabilitySchema>;
export type ExtensionHostCapabilities = z.infer<typeof extensionHostCapabilitiesSchema>;
export type ExtensionHostCompatibility = z.infer<typeof extensionHostCompatibilitySchema>;
