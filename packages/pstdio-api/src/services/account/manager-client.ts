import { serviceAddress, serviceUrl } from "pstdio-sync/relay";
import { z } from "zod";

// The manager may run under a path, such as https://base.prompt.studio/accounts.
export const managerOriginSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  })
  .transform(serviceAddress);

export class ManagerRequestDenied extends Error {
  constructor(readonly status: number) {
    super("Account service request denied or unavailable");
  }
}
export const managerRequest = async (
  origin: string,
  path: string,
  token?: string,
  body?: unknown,
  signal?: AbortSignal,
) => {
  const response = await fetch(serviceUrl(origin, path), {
    method: body === undefined ? "GET" : "POST",
    redirect: "error",
    headers: {
      origin: new URL(origin).origin,
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new ManagerRequestDenied(response.status);
  return response.json() as Promise<unknown>;
};
