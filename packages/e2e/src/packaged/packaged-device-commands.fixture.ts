import { createLiveHub, defaultRelayLimits } from "pstdio-relay";
import { syncPath, syncRoute } from "pstdio-sync-contracts";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

/** Disposable manager identities with the production relay call router and frame limits. */
export const createDeviceCommandPeer = (tls: { key: Bun.BunFile; cert: Bun.BunFile } | undefined) => {
  const durable = createPackagedSyncPeer(undefined);
  const devices = new Map<string, { name: string; publicKey?: string }>();
  const hub = createLiveHub(defaultRelayLimits, () => true);
  const frames: string[] = [];
  const credentials = new Map<string, string>();
  const accessTokens = new Map<string, { deviceId: string; projectId: string }>();
  const signingKeyRequest = async (request: Request, path: string, deviceId?: string) => {
    if (path === "/v1/devices/signing-key") {
      const device = deviceId && devices.get(deviceId);
      if (!device) return new Response(null, { status: 401 });
      device.publicKey = (await request.json()).publicKey;
      return Response.json({ ok: true });
    }
    const signingKey = /^\/v1\/devices\/([^/]+)\/signing-key$/.exec(path);
    if (!signingKey) return null;
    const publicKey = devices.get(decodeURIComponent(signingKey[1]!))?.publicKey;
    return publicKey ? Response.json({ publicKey }) : new Response(null, { status: 404 });
  };
  const managerRequest = async (request: Request, url: URL, deviceId?: string) => {
    const signingKey = await signingKeyRequest(request, url.pathname, deviceId);
    if (signingKey) return signingKey;
    if (url.pathname === "/v1/device-login") {
      const profile = await request.clone().json();
      devices.set(profile.deviceId, { name: profile.name });
      const response = await fetch(`${durable.origin}${url.pathname}`, request);
      const value = await response.json();
      credentials.set(value.token, profile.deviceId);
      return Response.json({ ...value, relayOrigin: url.origin });
    }
    if (url.pathname === "/v1/environment-access") {
      if (!deviceId || !devices.has(deviceId)) return new Response(null, { status: 401 });
      const input = await request.clone().json();
      const response = await fetch(`${durable.origin}${url.pathname}`, request);
      if (!response.ok) return response;
      const value = await response.json();
      accessTokens.set(value.token, { deviceId, projectId: String(input.workbenchId) });
      return Response.json(value);
    }
    if (url.pathname === "/v1/devices/presence") return Response.json({ ok: true });
    if (url.pathname === "/v1/devices")
      return Response.json({
        deviceId,
        devices: [...devices].map(([id, value]) => ({
          id,
          name: value.name,
          platform: "fixture",
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          online: true,
        })),
      });
    if (/^\/v1\/devices\/[^/]+\/remove$/.test(url.pathname)) return Response.json({ ok: true });
    return null;
  };
  const forward = async (request: Request, url: URL) => {
    const headers = new Headers(request.headers);
    const response = await fetch(`${durable.origin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      ...(request.method !== "GET" && request.method !== "HEAD" ? { body: await request.arrayBuffer() } : {}),
    });
    const changed = syncRoute(url.pathname);
    if (changed?.kind === "document" && changed.operation !== "read" && request.method === "POST" && response.ok) {
      const body = await response.clone().json();
      hub.changed({
        projectKey: syncPath({ kind: "live", projectId: changed.projectId }),
        spaceOwner: changed.spaceOwner,
        documentId: changed.documentId,
        lastSequence: body.sequence ?? body.state?.through ?? 0,
        stateId: body.state?.stateId ?? null,
        created: true,
      });
    }
    return response;
  };
  const server = Bun.serve<{ handler: ReturnType<typeof hub.connect> }>({
    hostname: "127.0.0.1",
    port: 0,
    tls,
    async fetch(request, server) {
      const url = new URL(request.url);
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const access = accessTokens.get(token);
      const deviceId = credentials.get(token) ?? access?.deviceId;
      if (url.pathname.endsWith("/live")) {
        const route = syncRoute(url.pathname);
        if (!deviceId || !devices.has(deviceId) || !access || route?.projectId !== access.projectId)
          return new Response(null, { status: 401 });
        const handler = hub.connect({
          projectKey: url.pathname,
          accountId: "owner",
          deviceId,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        if (server.upgrade(request, { data: { handler } })) return;
        return new Response(null, { status: 426 });
      }
      return (await managerRequest(request, url, deviceId)) ?? forward(request, url);
    },
    websocket: {
      open(socket) {
        socket.data.handler.open(socket);
      },
      message(socket, data) {
        frames.push(String(data));
        socket.data.handler.message(data);
      },
      close(socket) {
        socket.data.handler.close();
      },
    },
  });
  return {
    origin: server.url.origin,
    frames,
    async close() {
      await server.stop(true);
      await durable.stop();
    },
  };
};
