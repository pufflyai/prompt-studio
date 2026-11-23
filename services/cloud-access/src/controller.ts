import { AccessError } from "./config";

export function createController(origin: string, issuerToken: () => Promise<string>) {
  async function request(path: string, method: string, body?: unknown, token?: string) {
    const result = await fetch(new URL(path, origin), {
      method,
      headers: { Authorization: `Bearer ${token ?? (await issuerToken())}`, "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new AccessError(502, "Controller authorization is unavailable.");
    return result.json();
  }
  return {
    async createPrincipal(name: string, scopes: string[], templates: string[]) {
      const result = await request("/v1/principals", "POST", { name, scopes, templates });
      if (typeof result.id !== "string") throw new AccessError(502, "Controller returned an invalid principal.");
      return result.id as string;
    },
    async issue(principalId: string, scopes: string[], templates: string[], expiresAt: string) {
      const result = await request(`/v1/principals/${principalId}/keys`, "POST", {
        request_id: crypto.randomUUID(),
        scopes,
        templates,
        expires_at: expiresAt,
      });
      if (
        typeof result.token !== "string" ||
        typeof result.key?.id !== "string" ||
        !Number.isFinite(Date.parse(result.key?.expires_at)) ||
        Date.parse(result.key.expires_at) > Date.parse(expiresAt) ||
        Date.parse(result.key.expires_at) <= Date.now()
      )
        throw new AccessError(502, "Controller returned an invalid credential.");
      return {
        secret: result.token as string,
        id: result.key.id as string,
        expiresAt: result.key.expires_at as string,
      };
    },
    async revoke(principalId: string) {
      await request(`/v1/principals/${principalId}/keys`, "DELETE");
    },
    async revokeKey(principalId: string, id: string) {
      await request(`/v1/principals/${principalId}/keys/${id}`, "DELETE");
    },
    async workspace(id: string, token: string) {
      return request(`/v1/workspaces/${id}`, "GET", undefined, token);
    },
  };
}
export type Controller = ReturnType<typeof createController>;
