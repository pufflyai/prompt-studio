import { z } from "zod";

export const cloudDeviceProviderSchema = z.strictObject({
  token: z.string().trim().min(1).max(512),
  region: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
  size: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  image: z.string().regex(/^ghcr\.io\/pufflyai\/prompt-studio\/device@sha256:[a-f0-9]{64}$/),
});
export type CloudDeviceProviderInput = z.infer<typeof cloudDeviceProviderSchema>;
export type CloudDeviceProvider =
  | { configured: false }
  | ({ configured: true } & Omit<CloudDeviceProviderInput, "token">);
export const startCloudDeviceSchema = z.union([
  z.strictObject({ name: z.string().trim().min(1).max(100) }),
  z.strictObject({ id: z.uuid() }),
]);
export type StartCloudDeviceInput = z.infer<typeof startCloudDeviceSchema>;
export interface CloudDevice {
  id: string;
  name: string;
  providerId: string | null;
  /** Provider power state. It does not imply enrollment, sync, or command readiness. */
  power: string;
  /** Derived from ordinary account presence; null when the account service is unavailable. */
  online: boolean | null;
}

export const prepareCloudDeviceBootstrapSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  id: z.uuid().optional(),
});
export type PrepareCloudDeviceBootstrapInput = z.infer<typeof prepareCloudDeviceBootstrapSchema>;
export interface CloudDeviceBootstrapFile {
  deviceId: string;
  path: string;
  expiresAt: string;
}
