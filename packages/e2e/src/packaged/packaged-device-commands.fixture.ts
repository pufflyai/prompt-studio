import { createLiveHub, defaultRelayLimits } from "pstdio-relay";
import { syncPath, syncRoute } from "pstdio-sync-contracts";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";

/** Disposable manager identities with the production relay call router and frame limits. */
export const createDeviceCommandPeer = (tls?: { key: Bun.BunFile; cert: Bun.BunFile }) => {
  const durable = createPackagedSyncPeer(undefined);
  const devices = new Map<string, { name: string; accountId: string; publicKey?: string }>();
  const credentials = new Map<string, string>();
  const accessTokens = new Map<string, { deviceId: string; accountId: string; projectId: string; expiresAt: string }>();
  const enrollmentCredentials = new Map<string, string>();
  const grants = new Map<string, { deviceId: string; name: string }>();
  const keyDevices = new Set<string>();
  let enrollmentCount = 0;
  const hub = createLiveHub(defaultRelayLimits, () => true);
  const frames: string[] = [];
  const signingKeyRequest = async (request: Request, path: string, deviceId?: string) => {
    if (path === "/v1/devices/signing-key") {
      const device = deviceId && devices.get(deviceId);
      if (!device) return new Response(null, { status: 401 });
      device.publicKey = (await request.json()).publicKey;
      return Response.json({ ok: true });
    }
    const signingKey = /^\/v1\/devices\/([^/]+)\/signing-key$/.exec(path);
    if (!signingKey) return null;
    if (!deviceId || !devices.has(deviceId)) return new Response(null, { status: 401 });
    const publicKey = devices.get(decodeURIComponent(signingKey[1]!))?.publicKey;
    return publicKey ? Response.json({ publicKey }) : new Response(null, { status: 404 });
  };
  const enrollDevice = async (request: Request, origin: string) => {
    const profile = await request.clone().json();
    const response = await fetch(`${durable.origin}/v1/device-login`, request);
    if (!response.ok) return response;
    const enrolled = (await response.json()) as { accountId: string; deviceId: string; token: string };
    devices.set(enrolled.deviceId, { name: profile.name, accountId: enrolled.accountId });
    credentials.set(enrolled.token, enrolled.deviceId);
    return Response.json({ ...enrolled, relayOrigin: origin });
  };
  const environmentAccess = async (request: Request, deviceId?: string) => {
    if (!deviceId || !devices.has(deviceId)) return new Response(null, { status: 401 });
    const input = (await request.clone().json()) as { workbenchId: string };
    const response = await fetch(`${durable.origin}/v1/environment-access`, request);
    if (!response.ok) return response;
    const access = (await response.json()) as { token: string; expiresAt: string };
    accessTokens.set(access.token, {
      deviceId,
      accountId: devices.get(deviceId)!.accountId,
      projectId: input.workbenchId,
      expiresAt: access.expiresAt,
    });
    return Response.json(access);
  };
  const cloudEnrollmentRequest = async (request: Request, url: URL, deviceId?: string) => {
    if (url.pathname === "/v1/devices/enrollment") {
      if (!deviceId || !devices.has(deviceId)) return new Response(null, { status: 401 });
      const profile = await request.json();
      const grant = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
      grants.set(grant, profile);
      return Response.json({ grant, expiresAt: new Date(Date.now() + 900_000).toISOString() }, { status: 201 });
    }
    if (url.pathname === "/v1/devices/enrollment/consume") {
      const input = await request.json();
      const grant = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const profile = grants.get(grant);
      if (!profile || profile.deviceId !== input.deviceId || devices.has(input.deviceId))
        return new Response(null, { status: 401 });
      grants.delete(grant);
      const response = await enrollDevice(
        new Request(`${url.origin}/v1/device-login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(profile),
        }),
        url.origin,
      );
      if (!response.ok) return response;
      const enrolled = await response.json();
      enrollmentCredentials.set(input.token, enrolled.token);
      enrollmentCount++;
      return Response.json(
        { accountId: enrolled.accountId, deviceId: enrolled.deviceId, relayOrigin: url.origin },
        { status: 201 },
      );
    }
    return null;
  };
  const listedDevices = (deviceId?: string) => {
    if (!deviceId || !devices.has(deviceId)) return new Response(null, { status: 401 });
    return Response.json({
      accountId: devices.get(deviceId)!.accountId,
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
  };
  const managerRequest = async (request: Request, url: URL, deviceId?: string) => {
    const cloud = await cloudEnrollmentRequest(request, url, deviceId);
    if (cloud) return cloud;
    const signingKey = await signingKeyRequest(request, url.pathname, deviceId);
    if (signingKey) return signingKey;
    if (url.pathname === "/v1/device-login") return enrollDevice(request, url.origin);
    if (url.pathname === "/v1/environment-access") return environmentAccess(request, deviceId);
    if (url.pathname === "/v1/devices/presence") return Response.json({ ok: true });
    if (url.pathname === "/v1/devices") return listedDevices(deviceId);
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
  const enrollmentCredentialRequest = (request: Request, url: URL) => {
    const incoming = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const token = enrollmentCredentials.get(incoming) ?? incoming;
    if (token !== incoming) {
      const headers = new Headers(request.headers);
      headers.set("authorization", `Bearer ${token}`);
      request = new Request(request, { headers });
    }
    const deviceId = credentials.get(token);
    if (/^\/v1\/workbenches\/[^/]+\/keys$/.test(url.pathname) && deviceId) keyDevices.add(deviceId);
    return request;
  };
  const server = Bun.serve<{ handler: ReturnType<typeof hub.connect> }>({
    hostname: "127.0.0.1",
    port: 0,
    tls,
    async fetch(request, server) {
      const url = new URL(request.url);
      request = enrollmentCredentialRequest(request, url);
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const route = syncRoute(url.pathname);
      if (url.pathname.startsWith("/sync/")) {
        if (!route) return new Response(null, { status: 404 });
        const access = accessTokens.get(token);
        if (!access || access.projectId !== route.projectId || Date.parse(access.expiresAt) <= Date.now())
          return new Response(null, { status: 403 });
        if (route.kind === "live") {
          const handler = hub.connect({
            projectKey: syncPath({ kind: "live", projectId: route.projectId }),
            accountId: access.accountId,
            deviceId: access.deviceId,
            expiresAt: access.expiresAt,
          });
          if (server.upgrade(request, { data: { handler } })) return;
          return new Response(null, { status: 426 });
        }
      }
      return (await managerRequest(request, url, credentials.get(token))) ?? forward(request, url);
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
    enrolled: () => enrollmentCount,
    keyDevices,
    async close() {
      await server.stop(true);
      await durable.stop();
    },
  };
};
