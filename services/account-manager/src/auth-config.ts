import { z } from "zod";

// A service address may include a path, such as https://base.prompt.studio/accounts.
const origin = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  })
  .transform((value) => new URL(value).href.replace(/\/+$/, ""));
const seconds = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER / 1000);
const schema = z
  .strictObject({
    databaseUrl: z.string().min(1),
    origin,
    audience: origin,
    secret: z.string().min(32),
    googleClientId: z.string().min(1),
    googleClientSecret: z.string().min(1),
    sessionLifetimeSeconds: seconds,
    sessionUpdateAgeSeconds: seconds,
    accessLifetimeSeconds: seconds,
  })
  .refine((value) => value.sessionUpdateAgeSeconds < value.sessionLifetimeSeconds);

export type ManagerAuthConfig = z.input<typeof schema>;
export const parseManagerAuthConfig = (input: ManagerAuthConfig) => {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("Invalid authentication configuration");
  return result.data;
};
