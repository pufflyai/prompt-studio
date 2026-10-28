import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { openUpdate, sealUpdate, UnreadableSyncData } from "pstdio-sync/encryption";
import { fetchSyncSpaces } from "pstdio-sync/relay";
import {
  type LiveServerMessage,
  liveServerMessageSchema,
  readResultSchema,
  type SyncRoute,
  stateResultSchema,
  syncErrorSchema,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
  updateResultSchema,
} from "pstdio-sync-contracts";
import { defaultRelayLimits } from "../limits";
import { startRelay } from "../service";
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
        headers: { authorization: `Bearer ${token}`, [syncProtocolHeader]: String(syncProtocolVersion) },
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
    expect(await listener.next()).toMatchObject({ type: "changed", documentId: second, lastSequence: 1 });
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
    expect(await sender.next()).toEqual({ type: "ready", protocolVersion: syncProtocolVersion });
    expect(await receiver.next()).toEqual({ type: "ready", protocolVersion: syncProtocolVersion });
    const payload = encode(crypto.getRandomValues(new Uint8Array(48)));
    sender.socket.send(JSON.stringify({ type: "live", spaceOwner: null, payload }));
    expect(await receiver.next()).toEqual({
      type: "live",
      spaceOwner: null,
      deviceId: relay.context.environmentId,
      payload,
    });
    const documentId = randomId("doc");
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
    sender.socket.send(JSON.stringify({ type: "live", spaceOwner: randomId("user"), payload }));
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
