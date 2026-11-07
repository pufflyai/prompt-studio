export const packagedAccountId = "owner";
/** The one-use sign-in code that signs a device in to another account of the same peer. */
export const packagedAccountCode = (accountId: string) => `account:${accountId}`;

/** Controlled account credentials bind every relay request to its enrolled account, device and project. */
export const createPackagedSyncIdentity = () => {
  let earlyAccess = true;
  const devices = new Map<string, { name: string; accountId: string }>();
  const credentials = new Map<string, { deviceId: string; accountId: string }>();
  const accessTokens = new Map<string, { deviceId: string; projectId: string; accountId: string }>();
  const token = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const device = (request: Request) => credentials.get(token(request))?.deviceId;
  // Sign-in sessions name their account; a device enrolled without one belongs to the default account.
  const sessionAccount = (session: string) =>
    session.startsWith("session:") ? session.slice("session:".length) : packagedAccountId;
  const updateDevice = async (request: Request, id: string, action: string) => {
    if (action === "rename") {
      const input = (await request.json()) as { name: string };
      const entry = devices.get(id);
      if (entry) entry.name = input.name;
    } else {
      devices.delete(id);
      for (const [credential, owner] of credentials) if (owner.deviceId === id) credentials.delete(credential);
    }
    return Response.json({ ok: true });
  };
  // A one-use code names its account; device enrollment and the device list stay inside that account.
  const signIn = async (request: Request, path: string, origin: string) => {
    if (path === "/api/auth/one-time-token/verify") {
      const code = String(((await request.json()) as { token?: unknown }).token ?? "");
      const accountId = code.startsWith("account:") ? code.slice("account:".length) : packagedAccountId;
      return Response.json({
        session: { token: `session:${accountId}`, expiresAt: new Date(Date.now() + 60_000) },
        user: { id: accountId, email: `${accountId}@example.test` },
      });
    }
    if (path === "/v1/device-login") {
      const profile = (await request.json()) as { deviceId: string; name: string };
      const deviceId = String(profile.deviceId);
      const accountId = sessionAccount(token(request));
      devices.set(deviceId, { name: String(profile.name), accountId });
      const credential = crypto.randomUUID();
      credentials.set(credential, { deviceId, accountId });
      return Response.json({ accountId, deviceId, token: credential, relayOrigin: origin });
    }
    if (path === "/v1/devices")
      return Response.json({
        deviceId: device(request),
        devices: [...devices].flatMap(([id, { name, accountId }]) =>
          accountId === credentials.get(token(request))?.accountId
            ? [
                {
                  id,
                  name,
                  platform: "fixture",
                  createdAt: new Date().toISOString(),
                  lastSeenAt: new Date().toISOString(),
                  online: true,
                },
              ]
            : [],
        ),
      });
    return null;
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
      const signedIn = await signIn(request, path, origin);
      if (signedIn) return signedIn;
      if (path === "/api/auth/sign-out") return Response.json({ ok: true });
      if (path === "/v1/environment-access") {
        const enrolled = credentials.get(token(request));
        if (!enrolled) return new Response(null, { status: 401 });
        const body = (await request.json()) as { workbenchId: string };
        const issued = crypto.randomUUID();
        accessTokens.set(issued, { ...enrolled, projectId: String(body.workbenchId) });
        return Response.json({ token: issued, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      const deviceAction = /^\/v1\/devices\/([^/]+)\/(rename|remove)$/.exec(path);
      if (deviceAction) return updateDevice(request, decodeURIComponent(deviceAction[1]!), deviceAction[2]!);
      if (path === "/v1/account") return Response.json({ features: { relay: earlyAccess } });
      return null;
    },
    /** The account of an enrolled device credential. */
    account: (request: Request) => credentials.get(token(request))?.accountId,
    access(request: Request, projectId: string) {
      const access = accessTokens.get(token(request));
      return access?.projectId === projectId ? access : undefined;
    },
  };
};
