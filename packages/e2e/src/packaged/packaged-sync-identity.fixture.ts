/** Controlled account credentials bind every relay request to its enrolled device and project. */
export const createPackagedSyncIdentity = () => {
  let earlyAccess = true;
  const devices = new Map<string, string>();
  const credentials = new Map<string, string>();
  const accessTokens = new Map<string, { deviceId: string; projectId: string }>();
  const token = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const device = (request: Request) => credentials.get(token(request));
  const updateDevice = async (request: Request, id: string, action: string) => {
    if (action === "rename") {
      const input = (await request.json()) as { name: string };
      devices.set(id, input.name);
    } else {
      devices.delete(id);
      for (const [credential, owner] of credentials) if (owner === id) credentials.delete(credential);
    }
    return Response.json({ ok: true });
  };
  return {
    setEarlyAccess(enabled: boolean) {
      earlyAccess = enabled;
    },
    async request(request: Request, path: string, origin: string) {
      if (path === "/v1/native-login" && request.method === "GET")
        return new Response("Controlled sign-in. Complete or cancel through the test.", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      if (path === "/api/auth/one-time-token/verify")
        return Response.json({
          session: { token: "session", expiresAt: new Date(Date.now() + 60_000) },
          user: { id: "owner", email: "owner@example.test" },
        });
      if (path === "/v1/device-login") {
        const profile = (await request.json()) as { deviceId: string; name: string };
        const deviceId = String(profile.deviceId);
        devices.set(deviceId, String(profile.name));
        const token = crypto.randomUUID();
        credentials.set(token, deviceId);
        return Response.json({ accountId: "owner", deviceId, token, relayOrigin: origin });
      }
      if (path === "/v1/devices")
        return Response.json({
          deviceId: device(request),
          devices: [...devices].map(([id, name]) => ({
            id,
            name,
            platform: "fixture",
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            online: true,
          })),
        });
      if (path === "/api/auth/sign-out") return Response.json({ ok: true });
      if (path === "/v1/environment-access") {
        const deviceId = device(request);
        if (!deviceId) return new Response(null, { status: 401 });
        const body = (await request.json()) as { workbenchId: string };
        const token = crypto.randomUUID();
        accessTokens.set(token, { deviceId, projectId: String(body.workbenchId) });
        return Response.json({ token, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      const deviceAction = /^\/v1\/devices\/([^/]+)\/(rename|remove)$/.exec(path);
      if (deviceAction) return updateDevice(request, decodeURIComponent(deviceAction[1]!), deviceAction[2]!);
      if (path === "/v1/account") return Response.json({ features: { relay: earlyAccess } });
      return null;
    },
    access(request: Request, projectId: string) {
      const access = accessTokens.get(token(request));
      return access?.projectId === projectId ? access : undefined;
    },
  };
};
