import { AccessError } from "./config";

export function createSocketIssuer(socket: string, options: { now?: () => number; minimumValidityMs: number }) {
  const now = options.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | undefined;
  let pending: Promise<string> | undefined;
  async function issue() {
    const requestedExpiry = now() + 7200_000;
    const response = await fetch("http://localhost/v1/owner", {
      unix: socket,
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: crypto.randomUUID(),
        automation: true,
        replace: false,
        expires_at: new Date(requestedExpiry).toISOString(),
      }),
    });
    if (!response.ok) throw new AccessError(502, "Controller issuer authority is unavailable.");
    const value = (await response.json()) as { token?: unknown; key?: { expires_at?: string } };
    const expiresAt = Date.parse(value.key?.expires_at ?? "");
    if (
      typeof value.token !== "string" ||
      !Number.isFinite(expiresAt) ||
      expiresAt > requestedExpiry ||
      expiresAt < now() + options.minimumValidityMs
    )
      throw new AccessError(502, "Controller issuer authority is invalid.");
    cached = { token: value.token, expiresAt };
    return value.token;
  }
  return async () => {
    if (cached && cached.expiresAt > now() + options.minimumValidityMs + 60_000) return cached.token;
    if (!pending)
      pending = issue().finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
