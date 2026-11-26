import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import {
  createAuthenticationFixture,
  createOAuthCodeFixture,
  deviceProfile,
  fixtureMicrosoftClient,
  oauthBrowserCookie,
} from "pstdio-account-manager/testing";
import { openUpdate, sealState, sealUpdate, UnreadableSyncData } from "pstdio-sync/encryption";
import { fetchSyncSpaces } from "pstdio-sync/relay";
import {
  createdTeamInviteCodeSchema,
  type LiveServerMessage,
  liveProtocolHeader,
  liveProtocolVersion,
  liveServerMessageSchema,
  publicationDocumentNames,
  readResultSchema,
  type SyncRoute,
  stateResultSchema,
  syncErrorSchema,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
  teamAccountSchema,
  teamOwnershipOfferSchema,
  updateResultSchema,
} from "pstdio-sync-contracts";
import { z } from "zod";
import { defaultRelayLimits } from "../limits";
import { startRelay } from "../service";
import { projectKey } from "../storage/accounts";
import { encode, randomId, sha256 } from "../storage/sync-fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const open = async (options: Parameters<typeof fixture.context>[0] = {}) => {
  const context = await fixture.context(options);
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const request = (route: SyncRoute, init: RequestInit & { token?: string; version?: string } = {}) =>
    fetch(new URL(syncPath(route), server.url), {
      ...init,
      headers: {
        authorization: `Bearer ${init.token ?? context.token}`,
        [syncProtocolHeader]: init.version ?? String(syncProtocolVersion),
        ...(init.headers as Record<string, string>),
      },
    });
  const post = (route: SyncRoute, value: unknown, token?: string) =>
    request(route, { method: "POST", body: JSON.stringify(value), token });
  return {
    context,
    server,
    request,
    post,
    /** A second device of the same account. */
    async device() {
      const environmentId = crypto.randomUUID();
      const device = await context.manager.registerDevice({
        accountId: context.scope.accountId,
        deviceId: environmentId,
        name: "Second sync device",
        platform: "linux",
      });
      return { environmentId, token: (await context.issue(device.token)).token };
    },
    connect(token = context.token) {
      const url = new URL(syncPath({ kind: "live", projectId: context.scope.workbenchId }), server.url);
      url.protocol = "ws:";
      const socket = new WebSocket(url, {
        headers: {
          authorization: `Bearer ${token}`,
          [syncProtocolHeader]: String(syncProtocolVersion),
          [liveProtocolHeader]: String(liveProtocolVersion),
        },
      });
      const messages: LiveServerMessage[] = [];
      const waiting: ((message: LiveServerMessage) => void)[] = [];
      const closed = Promise.withResolvers<CloseEvent>();
      socket.addEventListener("message", (event) => {
        const message = liveServerMessageSchema.parse(JSON.parse(String(event.data)));
        const next = waiting.shift();
        if (next) next(message);
        else messages.push(message);
      });
      socket.addEventListener("close", (event) => closed.resolve(event));
      return {
        socket,
        closed: closed.promise,
        next: () =>
          new Promise<LiveServerMessage>((resolve) => {
            const message = messages.shift();
            if (message) resolve(message);
            else waiting.push(resolve);
          }),
      };
    },
    async close() {
      await server.stop(true);
      await context.close();
    },
  };
};

test("a device stores updates and a latest state, and another device reads them over HTTP", async () => {
  const relay = await open();
  try {
    const projectId = relay.context.scope.workbenchId;
    const documentId = randomId("doc");
    const route = (operation: "updates" | "read" | "state") =>
      ({ kind: "document", projectId, spaceOwner: null, documentId, operation }) as const;
    const update = { updateId: randomId("update"), payload: encode(new Uint8Array([7, 7])), blobIds: [] };
    const appended = await relay.post(route("updates"), update);
    expect(updateResultSchema.parse(await appended.json())).toEqual({ sequence: 1, duplicate: false });
    expect(await (await relay.post(route("updates"), update)).json()).toEqual({ sequence: 1, duplicate: true });
    const replaced = await relay.post(route("state"), {
      stateId: randomId("state"),
      baseStateId: null,
      through: 1,
      payload: encode(new Uint8Array([1, 2, 3])),
      summary: encode(new Uint8Array([1])),
      blobIds: [],
    });
    const { state } = stateResultSchema.parse(await replaced.json());
    const other = await relay.device();
    const read = readResultSchema.parse(await (await relay.post(route("read"), { after: 0 }, other.token)).json());
    expect(read).toMatchObject({ status: "updates", state: { stateId: state.stateId }, lastSequence: 1 });
    const bytes = await relay.request(
      { kind: "state", projectId, spaceOwner: null, documentId, stateId: state.stateId },
      { token: other.token },
    );
    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  } finally {
    await relay.close();
  }
});

test("an encrypted file uploads in parts and downloads from an offset", async () => {
  const relay = await open();
  try {
    const blob = { projectId: relay.context.scope.workbenchId, spaceOwner: null, blobId: randomId("blob") };
    const bytes = crypto.getRandomValues(new Uint8Array(1024));
    const begun = await relay.post(
      { kind: "blob", ...blob, operation: "begin" },
      {
        sha256: sha256(bytes),
        byteLength: bytes.length,
      },
    );
    expect(await begun.json()).toMatchObject({ completed: false, parts: [] });
    const part = await relay.request(
      { kind: "part", ...blob, number: 1 },
      {
        method: "PUT",
        body: bytes,
        headers: { "pstdio-sha256": sha256(bytes), "content-length": String(bytes.length) },
      },
    );
    expect(part.status).toBe(200);
    expect((await relay.post({ kind: "blob", ...blob, operation: "finish" }, {})).status).toBe(200);
    const read = await relay.post({ kind: "blob", ...blob, operation: "read" }, { offset: 1000 });
    expect(read.headers.get("pstdio-byte-length")).toBe("24");
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(bytes.subarray(1000));
  } finally {
    await relay.close();
  }
});

test("a client on another protocol version gets a clear update message", async () => {
  const relay = await open();
  try {
    const route = {
      kind: "document",
      projectId: relay.context.scope.workbenchId,
      spaceOwner: null,
      documentId: randomId("doc"),
      operation: "read",
    } as const;
    const response = await relay.request(route, { method: "POST", body: JSON.stringify({ after: 0 }), version: "0" });
    expect(response.status).toBe(426);
    expect(syncErrorSchema.parse(await response.json())).toMatchObject({
      error: "protocol-unsupported",
      supported: [syncProtocolVersion],
    });
  } finally {
    await relay.close();
  }
});

test("only the owner's devices reach a personal space, and only project devices reach a project", async () => {
  const relay = await open();
  const stranger = await open();
  try {
    const projectId = relay.context.scope.workbenchId;
    const read = (spaceOwner: string, token?: string) =>
      relay.post(
        { kind: "document", projectId, spaceOwner, documentId: randomId("doc"), operation: "read" },
        { after: 0 },
        token,
      );
    expect((await read(relay.context.scope.accountId)).status).toBe(200);
    expect((await read(randomId("user"))).status).toBe(403);
    // A token for another project cannot name this one.
    expect((await read(relay.context.scope.accountId, stranger.context.token)).status).toBe(401);
  } finally {
    await Promise.all([relay.close(), stranger.close()]);
  }
});

test("projects of different accounts with the same ID stay separate", async () => {
  const projectId = `shared-${crypto.randomUUID()}`;
  const relay = await open({ workbenchId: projectId });
  const other = await fixture.context({ workbenchId: projectId });
  try {
    const listener = relay.connect(other.token);
    expect(await listener.next()).toMatchObject({ type: "ready" });
    listener.socket.send(JSON.stringify({ type: "discover", spaceOwner: null }));
    const route = (documentId: string, operation: "updates" | "read") =>
      ({ kind: "document", projectId, spaceOwner: null, documentId, operation }) as const;
    const update = { updateId: randomId("update"), payload: encode(new Uint8Array([5])), blobIds: [] };
    const first = randomId("doc");
    await relay.post(route(first, "updates"), update);
    const read = await relay.post(route(first, "read"), { after: 0 }, other.token);
    expect(await read.json()).toMatchObject({ status: "updates", lastSequence: 0, updates: [] });
    const second = randomId("doc");
    const written = await relay.post(route(second, "updates"), update, other.token);
    expect(await written.json()).toEqual({ sequence: 1, duplicate: false });
    // The other account's device hears only about its own project, never about the first write.
    expect(await listener.next()).toMatchObject({ type: "discovered", documentId: second, lastSequence: 1 });
    listener.socket.close();
  } finally {
    await Promise.all([relay.close(), other.close()]);
  }
});

test("live messages reach the project's other devices and are never stored", async () => {
  const relay = await open();
  try {
    const other = await relay.device();
    const sender = relay.connect();
    const receiver = relay.connect(other.token);
    expect(await sender.next()).toEqual({ type: "ready", protocolVersion: liveProtocolVersion });
    expect(await receiver.next()).toEqual({ type: "ready", protocolVersion: liveProtocolVersion });
    const payload = encode(crypto.getRandomValues(new Uint8Array(48)));
    const topic = randomId("topic");
    receiver.socket.send(JSON.stringify({ type: "subscribe", spaceOwner: null, topic }));
    // The round trip to follow confirms the subscription reached the relay before publishing.
    receiver.socket.send(JSON.stringify({ type: "follow", spaceOwner: null, topic }));
    await receiver.next();
    sender.socket.send(JSON.stringify({ type: "publish", spaceOwner: null, topic, payload }));
    expect(await receiver.next()).toEqual({
      type: "event",
      topic,
      spaceOwner: null,
      deviceId: relay.context.environmentId,
      payload,
    });
    const documentId = randomId("doc");
    const receiverSubscription = randomId("subscription");
    receiver.socket.send(
      JSON.stringify({ type: "subscribe", spaceOwner: null, topic: documentId, requestId: receiverSubscription }),
    );
    // Admit the other socket before follow snapshots its presence; otherwise a later
    // subscribers update can legitimately arrive before the document-change notice.
    expect(await receiver.next()).toEqual({ type: "control-result", requestId: receiverSubscription, retryAfterMs: 0 });
    sender.socket.send(JSON.stringify({ type: "subscribe", spaceOwner: null, topic: documentId }));
    sender.socket.send(JSON.stringify({ type: "follow", spaceOwner: null, topic: documentId }));
    await sender.next();
    await relay.post(
      {
        kind: "document",
        projectId: relay.context.scope.workbenchId,
        spaceOwner: null,
        documentId,
        operation: "updates",
      },
      { updateId: randomId("update"), payload: encode(new Uint8Array([1])), blobIds: [] },
    );
    expect(await receiver.next()).toEqual({
      type: "changed",
      spaceOwner: null,
      documentId,
      lastSequence: 1,
      stateId: null,
    });
    expect(await sender.next()).toMatchObject({ type: "changed", documentId });
    const database = new Client({ connectionString: fixture.relayDatabaseUrl });
    await database.connect();
    try {
      const tables = await database.query<{ name: string }>(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'",
      );
      for (const { name } of tables.rows) {
        const rows = await database.query<{ row: string }>(`SELECT t::text AS row FROM "${name}" t`);
        for (const { row } of rows.rows) expect(row).not.toContain(payload);
      }
    } finally {
      await database.end();
    }
    // A device cannot write into another user's personal space.
    sender.socket.send(JSON.stringify({ type: "publish", spaceOwner: randomId("user"), topic, payload }));
    expect((await sender.closed).code).toBe(1008);
    receiver.socket.close();
  } finally {
    await relay.close();
  }
});

test("a device over its request rate is told to slow down", async () => {
  const relay = await open({ limits: { ...defaultRelayLimits, requestsPerSecond: 0.001, requestBurst: 1 } });
  try {
    const route = {
      kind: "document",
      projectId: relay.context.scope.workbenchId,
      spaceOwner: null,
      documentId: randomId("doc"),
      operation: "read",
    } as const;
    expect((await relay.post(route, { after: 0 })).status).toBe(200);
    const limited = await relay.post(route, { after: 0 });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate-limited" });
  } finally {
    await relay.close();
  }
});

test("two devices exchange encrypted updates with keys from the account manager", async () => {
  const relay = await open();
  const manager = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: relay.context.managerHandler });
  try {
    const { accountId, workbenchId } = relay.context.scope;
    const spaces = (credential: string) =>
      fetchSyncSpaces({ managerOrigin: manager.url.origin, credential, accountId, workbenchId });
    const desktopLogin = await relay.context.manager.registerDevice({
      accountId,
      deviceId: crypto.randomUUID(),
      name: "Desktop",
      platform: "linux",
    });
    const laptop = { token: relay.context.token, spaces: await spaces(relay.context.device.token) };
    const desktop = {
      token: (await relay.context.issue(desktopLogin.token)).token,
      spaces: await spaces(desktopLogin.token),
    };
    const send = async (spaceOwner: string | null, text: string) => {
      const space = spaceOwner ? laptop.spaces.personal : laptop.spaces.project;
      const documentId = await space.documentId('["notes","records"]');
      const update = await sealUpdate(space, documentId, new TextEncoder().encode(text), []);
      const route = { kind: "document", projectId: workbenchId, spaceOwner, documentId, operation: "updates" } as const;
      expect((await relay.post(route, update)).status).toBe(200);
      return documentId;
    };
    const receive = async (spaceOwner: string | null, documentId: string, token: string) => {
      const route = { kind: "document", projectId: workbenchId, spaceOwner, documentId, operation: "read" } as const;
      const read = readResultSchema.parse(await (await relay.post(route, { after: 0 }, token)).json());
      if (read.status !== "updates") throw new Error("Expected updates");
      return read.updates;
    };
    const decrypt = async (
      space: typeof laptop.spaces.project,
      documentId: string,
      update: { updateId: string; payload: string },
    ) => new TextDecoder().decode(await openUpdate(space, documentId, update));

    const projectDocument = await send(null, "Aurora launch checklist");
    const [shared] = await receive(null, projectDocument, desktop.token);
    expect(await decrypt(desktop.spaces.project, projectDocument, shared)).toBe("Aurora launch checklist");
    const personalDocument = await send(accountId, "Draft reply to the keynote team");
    const [personal] = await receive(accountId, personalDocument, desktop.token);
    expect(await decrypt(desktop.spaces.personal, personalDocument, personal)).toBe("Draft reply to the keynote team");

    // After the desktop is removed, the laptop seals new updates with a key the desktop never received.
    await relay.context.manager.removeDevice({ accountId, deviceId: desktopLogin.deviceId });
    await expect(spaces(desktopLogin.token)).rejects.toThrow("Sync keys unavailable (401)");
    laptop.spaces = await spaces(relay.context.device.token);
    await send(null, "Move the pelican mascot to the Friday keynote");
    // Even holding every stored byte, the removed device reads only what was written before its removal.
    const [older, newer] = await receive(null, projectDocument, laptop.token);
    expect(await decrypt(desktop.spaces.project, projectDocument, older)).toBe("Aurora launch checklist");
    await expect(openUpdate(desktop.spaces.project, projectDocument, newer)).rejects.toBeInstanceOf(UnreadableSyncData);
    expect(await decrypt(laptop.spaces.project, projectDocument, newer)).toBe(
      "Move the pelican mascot to the Friday keynote",
    );
  } finally {
    await manager.stop(true);
    await relay.close();
  }
});

test("capability negotiation uploads a manifest graph and retains its children through a root update", async () => {
  const { createDocumentRelay } = await import("pstdio-sync/relay");
  const relay = await open();
  try {
    const projectId = relay.context.scope.workbenchId;
    const documentId = randomId("doc");
    const capability = { kind: "capabilities", projectId } as const;
    expect(await (await relay.request(capability)).json()).toEqual({
      protocolVersion: 1,
      features: ["blob-references-v1"],
    });
    expect((await relay.request(capability, { token: "invalid" })).status).toBe(401);
    expect((await relay.request({ ...capability, projectId: randomId("other") })).status).toBe(401);
    expect((await relay.request(capability, { version: "0" })).status).toBe(426);
    expect((await relay.post(capability, {})).status).toBe(405);
    const client = createDocumentRelay({
      origin: relay.server.url.origin,
      space: { projectId, spaceOwner: null },
      documentId,
      token: async () => relay.context.token,
      signal: new AbortController().signal,
    });
    const manifests = await client.manifestBlobs();
    const leafId = randomId("leaf");
    const rootId = randomId("root");
    const bytes = new Uint8Array([1, 3, 5]);
    await manifests.put(leafId, bytes, []);
    await manifests.put(rootId, bytes, [leafId]);
    await manifests.put(rootId, bytes, [leafId]);
    await expect(manifests.put(rootId, bytes, [])).rejects.toThrow("400");
    await expect(manifests.put(randomId("missing-parent"), bytes, [randomId("missing-child")])).rejects.toThrow("409");
    const legacy = await relay.post(
      { kind: "blob", projectId, spaceOwner: null, blobId: randomId("legacy"), operation: "begin" },
      { sha256: sha256(bytes), byteLength: bytes.length, children: [leafId] },
    );
    expect(legacy.status).toBe(400);
    await client.update({ updateId: randomId("update"), payload: encode(bytes), blobIds: [rootId] });
    await relay.context.sync.cleanup(new Date(Date.now() + 365 * 86_400_000));
    expect(await manifests.get(leafId, bytes.length)).toEqual(bytes);
    expect(await manifests.get(rootId, bytes.length)).toEqual(bytes);
    await expect(manifests.get(rootId, bytes.length - 1)).rejects.toThrow("length");
    const personal = createDocumentRelay({
      origin: relay.server.url.origin,
      space: { projectId, spaceOwner: relay.context.scope.accountId },
      documentId,
      token: async () => relay.context.token,
      signal: new AbortController().signal,
    });
    const personalBlobs = await personal.manifestBlobs();
    await expect(personalBlobs.put(randomId("personal"), bytes, [leafId])).rejects.toThrow("409");
  } finally {
    await relay.close();
  }
});

test("devices of the same team user share encrypted data under the team's project and their own private space", async () => {
  const relay = await open();
  const { manager, managerHandler, device, scope } = relay.context;
  const accountService = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: managerHandler });
  const managerOrigin = accountService.url.origin;
  const managerRequest = (token: string, path: string, body?: unknown) =>
    fetch(managerOrigin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const response = await managerRequest(device.token, "/v1/teams", { name: "Transport team" });
    expect(response.status).toBe(201);
    const { accountId } = teamAccountSchema.parse(await response.json());
    const projectId = scope.workbenchId;
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    const added = await managerRequest(device.token, `/v1/workbenches/${projectId}?accountId=${accountId}`, {});
    expect(added.status).toBe(200);
    const second = await manager.registerDevice({
      accountId: device.accountId,
      deviceId: crypto.randomUUID(),
      name: "Team laptop",
      platform: "linux",
    });

    const connectDevice = async (credential: string) => {
      const roster = await managerRequest(credential, `/v1/workbenches?accountId=${accountId}`);
      const [{ grantId }] = z.array(z.object({ grantId: z.string() })).parse(await roster.json());
      const issued = await managerRequest(credential, "/v1/environment-access", {
        accountId,
        workbenchId: projectId,
        grantId,
      });
      expect(issued.status).toBe(200);
      const { token } = z.object({ token: z.string() }).parse(await issued.json());
      const spaces = await fetchSyncSpaces({
        managerOrigin,
        credential,
        accountId,
        grantId,
        userId: device.accountId,
        workbenchId: projectId,
      });
      return { token, spaces };
    };
    const [first, laptop] = await Promise.all([connectDevice(device.token), connectDevice(second.token)]);
    for (const space of ["project", "personal"] as const) {
      const documentId = await first.spaces[space].documentId("test.sync");
      const route = { kind: "document", projectId, spaceOwner: first.spaces[space].spaceOwner, documentId } as const;
      const bytes = new TextEncoder().encode(`Encrypted ${space} record`);
      const outgoing = await sealUpdate(first.spaces[space], documentId, bytes, []);
      expect((await relay.post({ ...route, operation: "updates" }, outgoing, first.token)).status).toBe(200);
      const read = async (token: string) => {
        const result = readResultSchema.parse(
          await (await relay.post({ ...route, operation: "read" }, { after: 0 }, token)).json(),
        );
        if (result.status !== "updates") throw new Error("Expected updates");
        return result.updates;
      };
      expect(await read(relay.context.token)).toHaveLength(0);
      const [update] = await read(laptop.token);
      expect(await openUpdate(laptop.spaces[space], documentId, update)).toEqual(bytes);
    }
    const wrongPrivateOwner = {
      kind: "document",
      projectId,
      spaceOwner: accountId,
      documentId: randomId("doc"),
      operation: "read",
    } as const;
    expect((await relay.post(wrongPrivateOwner, { after: 0 }, laptop.token)).status).toBe(403);
    const live = relay.connect(laptop.token);
    expect((await live.next()).type).toBe("ready");
    live.socket.send(JSON.stringify({ type: "discover", spaceOwner: accountId }));
    expect((await live.closed).code).toBe(1008);
  } finally {
    await accountService.stop(true);
    await relay.close();
  }
});

test("two Microsoft work accounts join, share and hand over the private catalogue over Relay", async () => {
  const relay = await open({ microsoft: fixtureMicrosoftClient, accessLifetimeSeconds: 2 });
  const { manager, managerHandler, scope } = relay.context;
  const oauth = await createOAuthCodeFixture();
  const projectId = scope.workbenchId;
  const accountService = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: managerHandler });
  const managerOrigin = accountService.url.origin;
  const managerRequest = (token: string, path: string, body?: unknown) =>
    fetch(managerOrigin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const browserOrigin = relay.context.managerOrigin;
  const browserRequest = (path: string, body: unknown, cookie = "") =>
    managerHandler(
      new Request(browserOrigin + path, {
        method: "POST",
        headers: { origin: browserOrigin, "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );
  const tenantId = "354e60fc-fe06-4e97-aea7-664289bdd555";
  const microsoftSession = async (sub: string, oid: string) => {
    const callbackURL = `${browserOrigin}/v1/team-invitation`;
    const start = await browserRequest("/api/auth/sign-in/social", { provider: "microsoft", callbackURL });
    expect(start.status).toBe(200);
    const { url } = z.object({ url: z.url() }).parse(await start.json());
    const callback = await oauth.complete("microsoft", new URL(url), { claims: { tid: tenantId, sub, oid } });
    const signedIn = await managerHandler(
      new Request(callback.href, { headers: { cookie: oauthBrowserCookie(start) } }),
    );
    expect(signedIn.headers.get("location")).toBe(callbackURL);
    return oauthBrowserCookie(signedIn);
  };
  const enroll = async (cookie: string) => {
    const enrolled = await browserRequest("/v1/device-login", { ...deviceProfile(), provider: "microsoft" }, cookie);
    expect(enrolled.status).toBe(201);
    return z.object({ accountId: z.string(), token: z.string() }).parse(await enrolled.json());
  };
  try {
    const device = await enroll(await microsoftSession("private-team-owner", crypto.randomUUID()));
    const team = await managerRequest(device.token, "/v1/teams", { name: "Private Tool Team" });
    expect(team.status).toBe(201);
    const { accountId } = teamAccountSchema.parse(await team.json());
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    expect((await managerRequest(device.token, `/v1/workbenches/${projectId}?accountId=${accountId}`, {})).status).toBe(
      200,
    );
    const colleagueSession = await microsoftSession("private-team-colleague", crypto.randomUUID());
    const colleague = await enroll(colleagueSession);
    const teamPath = `/v1/teams/${accountId}`;
    const invite = await managerRequest(device.token, `${teamPath}/invite-codes`, {});
    expect(invite.status).toBe(201);
    const { code } = createdTeamInviteCodeSchema.parse(await invite.json());
    expect((await managerRequest(colleague.token, "/v1/team-invitations/accept", { secret: code })).status).toBe(200);
    const userId = colleague.accountId;
    const projectList = (token: string) => managerRequest(token, `/v1/workbenches?accountId=${accountId}`);
    expect(await (await projectList(colleague.token)).json()).toEqual([]);
    const projectAccess = `${teamPath}/projects/${projectId}/access`;
    expect((await managerRequest(device.token, projectAccess, { userId, granted: true })).status).toBe(200);
    const grantIdFor = async (credential: string) => {
      const list = await projectList(credential);
      return z.array(z.object({ grantId: z.string() })).parse(await list.json())[0]?.grantId;
    };
    const renew = async (credential: string) => {
      const result = await managerRequest(credential, "/v1/environment-access", {
        accountId,
        workbenchId: projectId,
        grantId: await grantIdFor(credential),
      });
      expect(result.status).toBe(200);
      return z.object({ token: z.string(), expiresAt: z.iso.datetime() }).parse(await result.json());
    };
    const [ownerLease, { token: memberToken }] = await Promise.all([renew(device.token), renew(colleague.token)]);
    const colleagueSpaces = async () =>
      fetchSyncSpaces({
        managerOrigin,
        credential: colleague.token,
        accountId,
        userId,
        grantId: await grantIdFor(colleague.token),
        workbenchId: projectId,
      });
    const { project } = await colleagueSpaces();

    const bytes = new TextEncoder().encode("Encrypted publication");
    for (const name of publicationDocumentNames) {
      const documentId = await project.documentId(name);
      const route = { kind: "document", projectId, spaceOwner: null, documentId } as const;
      const update = await sealUpdate(project, documentId, bytes, []);
      expect((await relay.post({ ...route, operation: "updates" }, update, memberToken)).status).toBe(200);
      expect((await relay.post({ ...route, operation: "updates" }, update, ownerLease.token)).status).toBe(200);
      const read = await relay.post({ ...route, operation: "read" }, { after: 0 }, memberToken);
      const result = readResultSchema.parse(await read.json());
      expect(result.status).toBe("updates");
      if (result.status !== "updates") throw new Error("Expected the owner’s publication");
      expect(await openUpdate(project, documentId, result.updates[0]!)).toEqual(bytes);
      const state = await sealState(project, documentId, {
        baseStateId: null,
        through: result.lastSequence,
        state: bytes,
        summary: new Uint8Array(),
        blobIds: [],
      });
      expect((await relay.post({ ...route, operation: "state" }, state, memberToken)).status).toBe(200);
    }

    const documentId = await project.documentId("ordinary-shared-project-data");
    const route = { kind: "document", projectId, spaceOwner: null, documentId, operation: "updates" } as const;
    expect((await relay.post(route, await sealUpdate(project, documentId, bytes, []), memberToken)).status).toBe(200);

    const { personal } = await fetchSyncSpaces({
      managerOrigin,
      credential: device.token,
      accountId,
      userId: device.accountId,
      grantId: await grantIdFor(device.token),
      workbenchId: projectId,
    });
    const privateId = await personal.documentId("private-session-history");
    const privateRoute = { ...route, spaceOwner: device.accountId, documentId: privateId };
    const privateBytes = new TextEncoder().encode("Former owner's private history");
    const privateUpdate = await sealUpdate(personal, privateId, privateBytes, []);
    const readPrivate = (token: string) => relay.post({ ...privateRoute, operation: "read" }, { after: 0 }, token);
    expect((await relay.post(privateRoute, privateUpdate, ownerLease.token)).status).toBe(200);
    expect((await readPrivate(memberToken)).status).toBe(403);

    const offer = await managerRequest(device.token, `${teamPath}/ownership`, { recipientUserId: userId });
    expect(offer.status).toBe(201);
    const { id } = teamOwnershipOfferSchema.parse(await offer.json());
    expect((await managerRequest(colleague.token, `${teamPath}/ownership/${id}`, { decision: "accept" })).status).toBe(
      200,
    );
    const [{ token: formerOwnerToken }, { token: successorToken }] = await Promise.all([
      renew(device.token),
      renew(colleague.token),
    ]);
    const catalogId = await project.documentId(publicationDocumentNames[1]);
    const catalog = { ...route, documentId: catalogId };
    const updated = await sealUpdate(project, catalogId, new TextEncoder().encode("Earlier revision selected"), []);
    expect((await relay.post(catalog, updated, formerOwnerToken)).status).toBe(200);
    expect((await relay.post(catalog, updated, successorToken)).status).toBe(200);
    expect((await readPrivate(successorToken)).status).toBe(403);
    expect((await relay.post(privateRoute, privateUpdate, successorToken)).status).toBe(403);
    const retained = readResultSchema.parse(await (await readPrivate(formerOwnerToken)).json());
    if (retained.status !== "updates") throw new Error("Expected the original owner's private history");
    expect(await openUpdate(personal, privateId, retained.updates[0]!)).toEqual(privateBytes);

    const grantId = await grantIdFor(device.token);
    expect(
      (await managerRequest(colleague.token, projectAccess, { userId: device.accountId, granted: false })).status,
    ).toBe(200);
    expect(await (await projectList(device.token)).json()).toEqual([]);
    expect(
      (await managerRequest(device.token, "/v1/environment-access", { accountId, workbenchId: projectId, grantId }))
        .status,
    ).toBe(401);
    expect((await relay.post(catalog, updated, formerOwnerToken)).status).toBe(403);

    await Bun.sleep(Math.max(0, Date.parse(ownerLease.expiresAt) - Date.now()) + 50);
    expect((await managerRequest(device.token, `${teamPath}/leave`, {})).status).toBe(200);
    const { token: remainingOwnerToken } = await renew(colleague.token);
    const { project: rotated } = await colleagueSpaces();
    expect(rotated.generation).toBeGreaterThan(project.generation);
    const newRevision = new TextEncoder().encode("Successor's revision");
    const afterCutover = await sealUpdate(rotated, catalogId, newRevision, []);
    await expect(openUpdate(project, catalogId, afterCutover)).rejects.toBeInstanceOf(UnreadableSyncData);
    expect((await relay.post(catalog, afterCutover, ownerLease.token)).status).toBe(401);
    const accepted = await relay.post(catalog, afterCutover, remainingOwnerToken);
    expect(accepted.status).toBe(200);
    expect(updateResultSchema.parse(await accepted.json()).duplicate).toBe(false);
    const currentCatalog = readResultSchema.parse(
      await (await relay.post({ ...catalog, operation: "read" }, { after: 0 }, remainingOwnerToken)).json(),
    );
    if (currentCatalog.status !== "updates") throw new Error("Expected the retained catalogue");
    expect(await openUpdate(rotated, catalogId, currentCatalog.updates[0]!)).toEqual(bytes);
    expect(await openUpdate(rotated, catalogId, currentCatalog.updates.at(-1)!)).toEqual(newRevision);
  } finally {
    oauth.close();
    await Promise.all([accountService.stop(true), relay.close()]);
  }
});

test("removing a disconnected team member cuts off the old lease and a replacement owner device recovers", async () => {
  const relay = await open({ accessLifetimeSeconds: 2 });
  const { manager, managerHandler, device, scope } = relay.context;
  const identity = createAuthenticationFixture(fixture.managerDatabaseUrl);
  const managerServer = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: managerHandler });
  const managerOrigin = managerServer.url.origin;
  const request = (token: string, path: string, body?: unknown) =>
    fetch(managerOrigin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const projectId = scope.workbenchId;
    const response = await request(device.token, "/v1/teams", { name: "Two-user transport team" });
    const { accountId } = teamAccountSchema.parse(await response.json());
    const team = `/v1/teams/${accountId}`;
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    expect((await request(device.token, `/v1/workbenches/${projectId}?accountId=${accountId}`, {})).status).toBe(200);

    const signedIn = await identity.login(crypto.randomUUID());
    const member = await identity.auth.loginDevice(signedIn.headers, { ...deviceProfile(), deviceId: device.deviceId });
    const invite = await request(device.token, `${team}/invite-codes`, {});
    const { code } = createdTeamInviteCodeSchema.parse(await invite.json());
    const redeemed = await request(member.token, "/v1/team-invitations/accept", { secret: code });
    expect(redeemed.status).toBe(200);
    expect(
      (await request(device.token, `${team}/projects/${projectId}/access`, { userId: member.accountId, granted: true }))
        .status,
    ).toBe(200);

    const grantIdFor = async (credential: string) => {
      const roster = await request(credential, `/v1/workbenches?accountId=${accountId}`);
      const candidates = z.array(z.object({ grantId: z.string() })).parse(await roster.json());
      return candidates[0]?.grantId;
    };
    const renew = async (credential: string, grantId?: string) =>
      request(credential, "/v1/environment-access", {
        accountId,
        workbenchId: projectId,
        grantId: grantId ?? (await grantIdFor(credential)),
      });
    const access = async (credential: string) => {
      const issued = await renew(credential);
      expect(issued.status).toBe(200);
      return z.object({ token: z.string(), expiresAt: z.iso.datetime() }).parse(await issued.json());
    };
    const spaces = async (user: { token: string; accountId: string }, grantId?: string) =>
      fetchSyncSpaces({
        managerOrigin,
        credential: user.token,
        accountId,
        grantId: grantId ?? (await grantIdFor(user.token)),
        userId: user.accountId,
        workbenchId: projectId,
      });
    const [ownerSpaces, memberSpaces, ownerLease, memberLease] = await Promise.all([
      spaces(device),
      spaces(member),
      access(device.token),
      access(member.token),
    ]);
    const documentId = await ownerSpaces.project.documentId("fixture.shared");
    const route = { kind: "document", projectId, spaceOwner: null, documentId } as const;
    const privateRoute = { ...route, spaceOwner: device.accountId, operation: "read" } as const;
    expect((await relay.post(privateRoute, { after: 0 }, memberLease.token)).status).toBe(403);
    expect(await memberSpaces.personal.documentId("fixture.private")).not.toBe(
      await ownerSpaces.personal.documentId("fixture.private"),
    );
    const ownerLive = relay.connect(ownerLease.token);
    expect((await ownerLive.next()).type).toBe("ready");
    const live = relay.connect(memberLease.token);
    expect((await live.next()).type).toBe("ready");
    live.socket.send(
      JSON.stringify({ type: "subscribe", spaceOwner: null, topic: documentId, requestId: "subscribed" }),
    );
    expect((await live.next()).type).toBe("control-result");
    ownerLive.socket.send(JSON.stringify({ type: "follow", spaceOwner: null, topic: documentId }));
    expect(await ownerLive.next()).toMatchObject({ type: "subscribers", active: true });
    ownerLive.socket.send(JSON.stringify({ type: "publish", spaceOwner: null, topic: documentId, payload: "AA==" }));
    expect(await live.next()).toMatchObject({ type: "event", payload: "AA==" });
    live.socket.send(JSON.stringify({ type: "discover", spaceOwner: device.accountId }));
    expect((await live.closed).code).toBe(1008);
    const send = async (space: typeof ownerSpaces.project, text: string, token: string) => {
      const bytes = new TextEncoder().encode(text);
      const body = await sealUpdate(space, documentId, bytes, []);
      const written = await relay.post({ ...route, operation: "updates" }, body, token);
      expect(written.status).toBe(200);
      return { bytes, update: { ...body, sequence: updateResultSchema.parse(await written.json()).sequence } };
    };
    const initial = await send(ownerSpaces.project, "owner contribution", ownerLease.token);
    const reply = await send(memberSpaces.project, "member contribution", memberLease.token);
    const read = async (token: string) => {
      const data = await relay.post({ ...route, operation: "read" }, { after: 0 }, token);
      const read = readResultSchema.parse(await data.json());
      if (read.status !== "updates") throw new Error("Expected shared updates");
      return read.updates;
    };
    expect(await openUpdate(memberSpaces.project, documentId, (await read(memberLease.token))[0])).toEqual(
      initial.bytes,
    );
    expect(await openUpdate(ownerSpaces.project, documentId, (await read(ownerLease.token))[1])).toEqual(reply.bytes);

    const removedGrant = z.string().parse(await grantIdFor(member.token));
    const staleEdit = await sealUpdate(memberSpaces.project, documentId, new TextEncoder().encode("offline edit"), []);
    const removeMember = `${team}/members/${member.accountId}/remove`;
    expect((await request(device.token, removeMember, {})).status).toBe(200);
    expect((await renew(member.token, removedGrant)).status).toBe(401);
    await expect(spaces(member, removedGrant)).rejects.toThrow("Sync keys unavailable");
    const lock = new Client({ connectionString: fixture.relayDatabaseUrl });
    await lock.connect();
    try {
      await lock.query("BEGIN");
      await lock.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `relay-project:${projectKey(accountId, projectId)}`,
      ]);
      const pending = relay.post({ ...route, operation: "read" }, { after: 0 }, memberLease.token);
      await fixture.waitForBlockedData(1, AbortSignal.timeout(500));
      const wait = Math.max(0, Date.parse(memberLease.expiresAt) - Date.now());
      const expired = await Promise.race([pending, Bun.sleep(wait + 500).then(() => undefined)]);
      expect(expired?.status).toBe(401);
    } finally {
      await lock.end();
    }
    expect((await relay.post({ ...route, operation: "read" }, { after: 0 }, memberLease.token)).status).toBe(401);
    expect((await relay.post({ ...route, operation: "updates" }, staleEdit, memberLease.token)).status).toBe(401);
    const rotated = await spaces(device);
    const current = await send(rotated.project, "after cutoff", (await access(device.token)).token);
    expect(await openUpdate(rotated.project, documentId, current.update)).toEqual(current.bytes);
    await expect(openUpdate(memberSpaces.project, documentId, current.update)).rejects.toThrow(UnreadableSyncData);

    const replacement = await manager.registerDevice({ accountId: device.accountId, ...deviceProfile() });
    const replacementSpaces = await spaces(replacement);
    const updates = await read((await access(replacement.token)).token);
    const recovered = await Promise.all(
      updates.map((update) => openUpdate(replacementSpaces.project, documentId, update)),
    );
    expect(recovered).toEqual([initial.bytes, reply.bytes, current.bytes]);
  } finally {
    await Promise.all([managerServer.stop(true), identity.close(), relay.close()]);
  }
});
