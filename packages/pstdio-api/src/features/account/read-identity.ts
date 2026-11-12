import { z } from "@hono/zod-openapi";
import { serviceAddress } from "pstdio-sync/relay";

// An expectation selects no remote target. It must match the native owner's existing identity.
const origin = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  })
  .transform(serviceAddress);
export const expectedAccountQuery = z
  .object({ accountId: z.string().min(1).optional(), managerOrigin: origin.optional() })
  .strict()
  .refine(
    (value) => Boolean(value.accountId) === Boolean(value.managerOrigin),
    "An expected account needs its manager origin",
  );
export const expectedProjectAccountQuery = z.union([
  expectedAccountQuery,
  z.object({ local: z.literal("true") }).strict(),
]);
export const readExpectedAccount = (query: z.infer<typeof expectedAccountQuery>) =>
  query.accountId && query.managerOrigin
    ? { accountId: query.accountId, managerOrigin: query.managerOrigin }
    : undefined;
