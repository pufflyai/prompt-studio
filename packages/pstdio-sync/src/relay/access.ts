import { managedExtensionHostHeader, type managedExtensionHostVersion } from "pstdio-sync-contracts";
import { fetchWithBackoff, serviceAddress, serviceUrl } from "./http";
import { fetchWithInactivity } from "./inactivity-response";

export type RelayAccess = { token: string; expiresAt: string; canPublish?: boolean };

export const createRelayAccess = (input: {
  managerOrigin: string;
  renewalGrant: string;
  workbenchId: string;
  accountId?: string;
  userId?: string;
  grantId?: string;
  managedExtensions?: typeof managedExtensionHostVersion;
  signal: AbortSignal;
  /** Called when the manager rejects the renewal credential. */
  denied?: () => void;
}) => {
  const address = serviceAddress(input.managerOrigin);
  let access: RelayAccess | undefined;
  let renewing: Promise<RelayAccess> | undefined;
  const renew = async () => {
    const response = await fetchWithBackoff(
      () =>
        fetchWithInactivity(
          serviceUrl(address, "/v1/environment-access"),
          {
            method: "POST",
            signal: input.signal,
            headers: {
              authorization: `Bearer ${input.renewalGrant}`,
              "content-type": "application/json",
              ...(input.managedExtensions && { [managedExtensionHostHeader]: input.managedExtensions }),
            },
            body: JSON.stringify({
              workbenchId: input.workbenchId,
              ...(input.userId && input.userId !== input.accountId && { accountId: input.accountId }),
              ...(input.grantId && { grantId: input.grantId }),
            }),
          },
          { signal: input.signal, inactivityMs: 30_000 },
        ),
      input.signal,
    );
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401) input.denied?.();
      throw new Error("Environment renewal unavailable");
    }
    const body = (await response.json()) as { token?: unknown; expiresAt?: unknown; canPublish?: unknown };
    if (typeof body.token !== "string" || !body.token || typeof body.expiresAt !== "string")
      throw new Error("Invalid environment access");
    const expires = Date.parse(body.expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error("Expired environment access");
    return {
      token: body.token,
      expiresAt: body.expiresAt,
      ...(typeof body.canPublish === "boolean" && { canPublish: body.canPublish }),
    };
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
