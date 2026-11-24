import { z } from "zod";

export const accountSignInProviderSchema = z.enum(["google", "microsoft"]);
export type AccountSignInProvider = z.infer<typeof accountSignInProviderSchema>;

export const accountSignInErrorSchema = z.enum(["provider-unavailable", "provider-denied", "provider-failed"]);
export type AccountSignInError = z.infer<typeof accountSignInErrorSchema>;
