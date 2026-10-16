import { z } from "zod";
import { completeLoginSchema } from "./contracts";

export const googleLoginConfigSchema = z.strictObject({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.hash && !url.username && !url.password;
  }),
  exchangeTimeoutMs: z.number().int().positive(),
});
export const googleCodeCompletionSchema = completeLoginSchema.omit({ owner: true }).extend({
  code: z.string().min(1),
});
export const googleTokenResponseSchema = z.object({ id_token: z.string().min(1) });
export type GoogleLoginConfig = z.input<typeof googleLoginConfigSchema>;
export type GoogleCodeCompletionInput = z.input<typeof googleCodeCompletionSchema>;
/** Trusted fetch transport must honor RequestInit signal/redirect and Response body cancellation. */
export type GoogleTransport = (url: string, options: RequestInit) => Promise<Response>;
