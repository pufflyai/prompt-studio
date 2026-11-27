import { serviceAddress, serviceUrl } from "pstdio-sync/relay";
import { managedExtensionHostHeader, managedExtensionHostVersion } from "pstdio-sync-contracts";
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
      [managedExtensionHostHeader]: managedExtensionHostVersion,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]),
  });
  if (!response.ok) throw new ManagerRequestDenied(response.status);
  return response.json() as Promise<unknown>;
};

export const supportsMicrosoftSignIn = async (origin: string) => {
  try {
    const providers = await managerRequest(
      origin,
      "/v1/sign-in-providers",
      undefined,
      undefined,
      AbortSignal.timeout(5000),
    );
    return z.object({ microsoft: z.literal(true) }).safeParse(providers).success;
  } catch (error) {
    if (error instanceof ManagerRequestDenied && error.status === 404) return false;
    throw error;
  }
};
