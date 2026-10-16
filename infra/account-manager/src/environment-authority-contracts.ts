import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";

export const environmentAuthorityPath = "/internal/v1/environment-authority";
export const environmentAuthorityRequestSchema = z.strictObject({
  token: z.string().min(1),
  workbenchId: identitySchema,
});
export const environmentAuthorityIdentitySchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  environmentId: identitySchema,
});
export const environmentAuthorityResponseSchema = z.strictObject({
  identity: environmentAuthorityIdentitySchema.nullable(),
});
export const environmentAuthorityServiceSchema = z.strictObject({ serviceSecret: z.string().min(1) });
export const environmentAuthorityClientSchema = environmentAuthorityServiceSchema.extend({
  origin: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
    );
  }),
  requestTimeoutMs: z.number().int().positive(),
});
export type EnvironmentAuthorityServiceConfig = z.input<typeof environmentAuthorityServiceSchema>;
export type EnvironmentAuthorityClientConfig = z.input<typeof environmentAuthorityClientSchema>;
/** Trusted transport must honor standard RequestInit signal/redirect and Response body cancellation. */
export type EnvironmentAuthorityTransport = (url: string, options: RequestInit) => Promise<Response>;
