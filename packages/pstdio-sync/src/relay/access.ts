import { relayOrigin } from "./http";

export const createRelayAccess = (input: {
  managerOrigin: string;
  renewalGrant: string;
  workbenchId: string;
  signal: AbortSignal;
}) => {
  const origin = relayOrigin(input.managerOrigin);
  let access: { token: string; expiresAt: string } | undefined;
  let renewing: Promise<{ token: string; expiresAt: string }> | undefined;
  const renew = async () => {
    const response = await fetch(new URL("/v1/environment-access", origin), {
      method: "POST",
      signal: input.signal,
      headers: { authorization: `Bearer ${input.renewalGrant}`, "content-type": "application/json" },
      body: JSON.stringify({ workbenchId: input.workbenchId }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Environment renewal unavailable");
    }
    const body = (await response.json()) as { token?: unknown; expiresAt?: unknown };
    if (typeof body.token !== "string" || !body.token || typeof body.expiresAt !== "string")
      throw new Error("Invalid environment access");
    const expires = Date.parse(body.expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error("Expired environment access");
    return { token: body.token, expiresAt: body.expiresAt };
  };
  return async () => {
    input.signal.throwIfAborted();
    if (access && Date.now() < Date.parse(access.expiresAt)) return access;
    renewing ??= renew();
    try {
      access = await renewing;
      return access;
    } finally {
      renewing = undefined;
    }
  };
};
