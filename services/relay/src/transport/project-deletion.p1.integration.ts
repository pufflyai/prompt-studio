import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import {
  fingerprint,
  liveProtocolHeader,
  liveProtocolVersion,
  projectDeletionServicePath,
  projectDeletionStatusSchema,
  type SyncRoute,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
} from "pstdio-sync-contracts";
import { reservationPrefix } from "../assets/object-reservations";
import { multipartSize } from "../assets/streams";
import { createProjectDeletionWorker } from "../project-deletion-worker";
import { startRelay } from "../service";
import { projectKey } from "../storage/accounts";
import { documentObjectPrefix } from "../storage/payloads";
import { encode, randomId, sha256 } from "../storage/sync-fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
const serviceToken = "owned-transport-fixture-deletion-secret";
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const client = (origin: URL, token: string) => (route: SyncRoute, body?: object) =>
  fetch(new URL(syncPath(route), origin), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, [syncProtocolHeader]: String(syncProtocolVersion) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const resumeExpiredUpload = async (input: {
  pg: Client;
  key: string;
  retryBlob: { projectId: string; blobId: string; spaceOwner: null };
  digest: string;
  assets: Awaited<ReturnType<typeof fixture.context>>["assets"];
  cleanup: () => Promise<unknown>;
  request: ReturnType<typeof client>;
}) => {
  const { pg, key, retryBlob, digest, assets, cleanup, request } = input;
  const beginAdmitted = Promise.withResolvers<void>();
  const allowBegin = Promise.withResolvers<void>();
  let pendingBegin: Promise<Response> | undefined;
  const begin = assets.begin;
  assets.begin = async (...args) => {
    if (args[1] === retryBlob.blobId) {
      beginAdmitted.resolve();
      await allowBegin.promise;
    }
    return begin(...args);
  };
  try {
    pendingBegin = request({ kind: "blob", ...retryBlob, operation: "begin" }, { byteLength: 3, sha256: digest });
    await beginAdmitted.promise;
    await pg.query(
      'UPDATE relay_sync_blobs SET "createdAt" = to_timestamp(0) WHERE "projectKey" = $1 AND "blobId" = $2',
      [key, retryBlob.blobId],
    );
    await cleanup();
    expect(
      (await pg.query('SELECT status FROM relay_sync_blobs WHERE "blobId" = $1', [retryBlob.blobId])).rows,
    ).toEqual([{ status: "open" }]);
    allowBegin.resolve();
    expect((await pendingBegin).status).toBe(200);
  } finally {
    allowBegin.resolve();
    await pendingBegin?.catch(() => {});
    assets.begin = begin;
  }
};

const retryLostAcknowledgement = async (input: {
  managerUrl: string;
  managerRequest: (request: Request) => Promise<Response>;
  deleteProject: Parameters<typeof createProjectDeletionWorker>[0]["deleteProject"];
  operationId: string;
  device: (method: "GET" | "POST") => Promise<Response>;
  pg: Client;
  key: string;
}) => {
  const { managerUrl, managerRequest, deleteProject, operationId, device, pg, key } = input;
  let attempts = 0;
  const afterCrash = createProjectDeletionWorker({
    managerUrl,
    token: serviceToken,
    deleteProject,
    async request(input) {
      if (new URL(input.url).pathname === projectDeletionServicePath && input.method === "POST") {
        attempts++;
        if (attempts === 1) throw new Error("Injected loss before manager acknowledgement");
        const response = await managerRequest(input);
        if (attempts === 2) throw new Error("Injected loss of acknowledgement response");
        return response;
      }
      return managerRequest(input);
    },
  });
  await expect(afterCrash(AbortSignal.timeout(5_000))).rejects.toThrow("before manager");
  expect(await (await device("GET")).json()).toMatchObject({
    operationId: operationId,
    state: "deleting",
  });
  expect(
    (await pg.query('SELECT "completedAt" FROM relay_project_retirements WHERE "projectKey" = $1', [key])).rows[0]
      .completedAt,
  ).toBeInstanceOf(Date);
  await expect(afterCrash(AbortSignal.timeout(5_000))).rejects.toThrow("acknowledgement response");
  const completed = projectDeletionStatusSchema.parse(await (await device("GET")).json());
  expect(completed).toMatchObject({ operationId: operationId, state: "completed" });
  await afterCrash(AbortSignal.timeout(5_000));
  expect(await (await device("GET")).json()).toEqual(completed);
};

test("permanent deletion drains a second relay replica, retries purge, and rejects originally valid access", async () => {
  const primary = await fixture.context({ projectDeletionRelayToken: serviceToken });
  const projectId = primary.scope.workbenchId;
  const secondary = await fixture.context({ workbenchId: projectId, projectDeletionRelayToken: serviceToken });
  const first = startRelay({ hostname: "127.0.0.1", port: 0 }, primary);
  // Withhold the notification on the other replica to exercise the durable live fence.
  secondary.sync.projectNotices.ready = async () => {};
  const second = startRelay({ hostname: "127.0.0.1", port: 0 }, secondary);
  const pg = new Client({ connectionString: fixture.relayDatabaseUrl });
  const finishAdmitted = Promise.withResolvers<void>();
  const allowFinish = Promise.withResolvers<void>();
  const accountId = primary.scope.accountId;
  const key = projectKey(accountId, projectId);
  const managerUrl = "https://manager.fixture.test";
  const projectPath = `/v1/workbenches/${projectId}/deletion`;
  const device = (method: "GET" | "POST") =>
    primary.managerHandler(
      new Request(managerUrl + projectPath, {
        method,
        headers: { authorization: `Bearer ${primary.device.token}` },
        ...(method === "POST" ? { body: JSON.stringify({ confirm: true }) } : {}),
      }),
    );
  const relay = client(first.url, primary.token);
  const stale = client(second.url, primary.token);
  const outside = client(second.url, secondary.token);
  const doc = { kind: "document", projectId, spaceOwner: null, documentId: randomId("doc") } as const;
  const update = { updateId: randomId("update"), payload: encode(new Uint8Array([1, 2])), blobIds: [] };
  const finishedBlob = { projectId, spaceOwner: null, blobId: randomId("blob") };
  const pendingBlob = { ...finishedBlob, spaceOwner: accountId, blobId: randomId("blob") };
  let publication: Promise<Response> | undefined;
  try {
    await pg.connect();
    expect((await outside({ ...doc, operation: "updates" }, update)).status).toBe(200);
    const outsideBlob = { projectId, spaceOwner: null, blobId: randomId("outside-blob") };
    expect(
      (
        await outside(
          { kind: "blob", ...outsideBlob, operation: "begin" },
          {
            byteLength: 0,
            sha256: sha256(new Uint8Array()),
          },
        )
      ).status,
    ).toBe(200);
    expect((await outside({ kind: "blob", ...outsideBlob, operation: "finish" })).status).toBe(200);
    const outsideObjects = await fixture.objectKeys();
    const outsideDocument = outsideObjects.find((key) => key.startsWith(reservationPrefix));
    expect(outsideDocument).toBeDefined();
    expect(outsideObjects).toEqual([outsideDocument!]);
    const empty = await outside({ kind: "blob", ...outsideBlob, operation: "read" }, { offset: 0 });
    expect(empty.status).toBe(200);
    expect((await empty.arrayBuffer()).byteLength).toBe(0);
    expect((await relay({ ...doc, operation: "updates" }, update)).status).toBe(200);
    expect(
      (await relay({ ...doc, spaceOwner: accountId, documentId: randomId("private"), operation: "updates" }, update))
        .status,
    ).toBe(200);
    expect(
      (
        await relay(
          { ...doc, operation: "state" },
          {
            stateId: randomId("state"),
            baseStateId: null,
            through: 1,
            summary: encode(new Uint8Array([0])),
            payload: update.payload,
            blobIds: [],
          },
        )
      ).status,
    ).toBe(200);

    const bytes = new Uint8Array([7, 8, 9]);
    const digest = sha256(bytes);
    for (const blob of [finishedBlob, pendingBlob]) {
      expect(
        (await relay({ kind: "blob", ...blob, operation: "begin" }, { byteLength: bytes.length, sha256: digest }))
          .status,
      ).toBe(200);
      expect(
        (
          await fetch(new URL(syncPath({ kind: "part", ...blob, number: 1 }), second.url), {
            method: "PUT",
            headers: {
              authorization: `Bearer ${primary.token}`,
              [syncProtocolHeader]: String(syncProtocolVersion),
              "pstdio-sha256": digest,
              "content-length": String(bytes.length),
            },
            body: bytes,
          })
        ).status,
      ).toBe(200);
    }
    expect(await fixture.multipartKeys()).toHaveLength(2);

    await resumeExpiredUpload({
      pg,
      key,
      retryBlob: { ...finishedBlob, spaceOwner: null, blobId: randomId("retry-blob") },
      digest,
      assets: secondary.assets,
      cleanup: primary.sync.cleanup,
      request: stale,
    });
    expect(await fixture.multipartKeys()).toHaveLength(3);

    // The retired document used legacy clear before its deletion queue tracked ownership.
    const olderKey = `${documentObjectPrefix(key, randomId("cleared"))}updates/${crypto.randomUUID()}`;
    await fixture.putLegacyObject(olderKey, new Uint8Array([3, 2, 1]));
    await pg.query('INSERT INTO relay_sync_object_deletions ("objectKey") VALUES ($1)', [olderKey]);
    const lostKey = `${documentObjectPrefix(key, randomId("cleared"))}updates/${crypto.randomUUID()}`;
    await fixture.putLegacyObject(lostKey, new Uint8Array([6, 5, 4]));
    // A legacy queued entry can also point to an update whose commit reply was lost.
    await pg.query('INSERT INTO relay_sync_object_deletions ("objectKey") VALUES ($1)', [outsideDocument]);

    const liveUrl = new URL(syncPath({ kind: "live", projectId }), second.url);
    liveUrl.protocol = "ws:";
    const socket = new WebSocket(liveUrl, {
      headers: {
        authorization: `Bearer ${primary.token}`,
        [syncProtocolHeader]: String(syncProtocolVersion),
        [liveProtocolHeader]: String(liveProtocolVersion),
      },
    });
    const liveReady = Promise.withResolvers<void>();
    const liveClosed = Promise.withResolvers<void>();
    socket.addEventListener("message", () => liveReady.resolve(), { once: true });
    socket.addEventListener("close", () => liveClosed.resolve(), { once: true });
    await liveReady.promise;

    const finish = secondary.assets.finish;
    secondary.assets.finish = async (...args) => {
      finishAdmitted.resolve();
      await allowFinish.promise;
      return finish(...args);
    };
    publication = stale({ kind: "blob", ...finishedBlob, operation: "finish" });
    await finishAdmitted.promise;
    const accepted = await device("POST");
    expect(accepted.status).toBe(202);
    const operation = projectDeletionStatusSchema.parse(await accepted.json());

    const remove = primary.assets.remove;
    primary.assets.remove = async () => {
      throw new Error("Injected object store failure");
    };
    const worker = createProjectDeletionWorker({
      managerUrl,
      token: serviceToken,
      deleteProject: primary.sync.deleteProject,
      request: primary.managerHandler,
    });
    const deletion = worker(AbortSignal.timeout(5_000));
    const waiting = new AbortController();
    const outcome = await Promise.race([
      fixture.waitForBlockedData(1, waiting.signal).then(() => "draining"),
      deletion.then(() => "finished"),
    ]).finally(() => waiting.abort());
    expect(outcome).toBe("draining");
    allowFinish.resolve();
    expect((await publication).status).toBe(200);
    await deletion;
    socket.send(JSON.stringify({ type: "subscribe", spaceOwner: null, topic: doc.documentId }));
    await liveClosed.promise;
    expect(await (await device("GET")).json()).toMatchObject({
      operationId: operation.operationId,
      state: "needs-attention",
    });
    expect((await stale({ ...doc, operation: "read" }, { after: 0 })).status).toBe(410);
    expect((await stale({ ...doc, operation: "updates" }, { ...update, updateId: randomId("late") })).status).toBe(410);

    primary.assets.remove = remove;
    expect((await device("POST")).status).toBe(202);
    const restarted = await fixture.context({ workbenchId: projectId });
    try {
      await retryLostAcknowledgement({
        managerUrl,
        managerRequest: primary.managerHandler,
        deleteProject: restarted.sync.deleteProject,
        operationId: operation.operationId,
        device,
        pg,
        key,
      });

      for (const table of ["projects", "documents", "updates", "states", "blobs", "object_deletions"]) {
        const rows = await pg.query(`SELECT * FROM relay_sync_${table} WHERE "projectKey" = $1`, [key]);
        expect(rows.rowCount).toBe(0);
      }
      for (const table of ["relay_asset_uploads", "relay_asset_parts", "relay_verified_assets"]) {
        const expected = table === "relay_asset_parts" ? 0 : 1;
        expect((await pg.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count).toBe(expected);
      }
      expect(await fixture.objectKeys()).toEqual(outsideObjects);
      expect(await fixture.multipartKeys()).toEqual([]);
      expect(await (await outside({ ...doc, operation: "read" }, { after: 0 })).json()).toMatchObject({
        lastSequence: 1,
      });
      expect(
        (await stale({ kind: "blob", ...pendingBlob, operation: "begin" }, { byteLength: 3, sha256: digest })).status,
      ).toBe(410);
    } finally {
      await restarted.close();
    }
  } finally {
    allowFinish.resolve();
    await publication?.catch(() => {});
    await Promise.all([first.stop(true), second.stop(true)]);
    await Promise.all([primary.close(), secondary.close(), pg.end()]);
  }
});

test.each(["document", "blob"] as const)("late multipart creation cannot leave a retired %s upload", async (kind) => {
  const proxy = fixture.deferMultipartCreation();
  const primary = await fixture.context({ objectEndpoint: proxy.endpoint, projectDeletionRelayToken: serviceToken });
  const replacement = await fixture.context({ workbenchId: primary.scope.workbenchId });
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, primary);
  try {
    const { workbenchId: projectId } = primary.scope;
    const request = client(server.url, primary.token);
    const bytes = new Uint8Array([1, 2]);
    const pending = await (kind === "document"
      ? request(
          { kind, projectId, spaceOwner: null, documentId: randomId("doc"), operation: "updates" },
          { updateId: randomId("update"), payload: encode(bytes), blobIds: [] },
        )
      : request(
          { kind, projectId, spaceOwner: null, blobId: randomId("blob"), operation: "begin" },
          { sha256: sha256(bytes), byteLength: bytes.byteLength },
        ));
    expect(pending.ok).toBe(false);

    const managerUrl = "https://manager.fixture.test";
    const deviceRequest = (method: "GET" | "POST") =>
      primary.managerHandler(
        new Request(`${managerUrl}/v1/workbenches/${projectId}/deletion`, {
          method,
          headers: { authorization: `Bearer ${primary.device.token}` },
          ...(method === "POST" ? { body: JSON.stringify({ confirm: true }) } : {}),
        }),
      );
    expect((await deviceRequest("POST")).status).toBe(202);
    await createProjectDeletionWorker({
      managerUrl,
      token: serviceToken,
      deleteProject: replacement.sync.deleteProject,
      request: primary.managerHandler,
    })(AbortSignal.timeout(5_000));
    expect(await (await deviceRequest("GET")).json()).toMatchObject({ state: "completed" });
    const other = replacement.scope;
    const owned = { projectKey: projectKey(other.accountId, other.workbenchId), blobId: randomId("unrelated") };
    await replacement.assets.begin(owned, owned.blobId, {
      sha256: sha256(bytes),
      byteLength: bytes.byteLength,
      mediaType: "application/octet-stream",
    });
    const before = await fixture.multipartKeys();
    const late = await proxy.finish();
    expect(await fixture.multipartKeys()).toContain(late);
    expect(late).toMatch(new RegExp(`^${reservationPrefix}[a-f0-9-]+$`));
    await replacement.sync.cleanup();
    expect(await fixture.multipartKeys()).toEqual(before);
    await replacement.assets.remove(owned, owned.blobId);
  } finally {
    await server.stop(true);
    await Promise.all([replacement.close(), primary.close(), proxy.close()]);
  }
});

test("resuming an empty legacy blob keeps the cleanup address without writing an object", async () => {
  const context = await fixture.context();
  const pg = new Client({ connectionString: fixture.relayDatabaseUrl });
  const blobId = randomId("legacy-empty");
  const owner = { projectKey: projectKey(context.scope.accountId, context.scope.workbenchId), blobId };
  const asset = { sha256: sha256(new Uint8Array()), byteLength: 0, mediaType: "application/octet-stream" };
  const objectKey = `assets/legacy/${blobId}`;
  try {
    await pg.connect();
    await context.assets.begin(owner, blobId, asset);
    await pg.query('UPDATE relay_asset_uploads SET "objectKey" = $1 WHERE id = $2', [objectKey, blobId]);
    await context.assets.finish(owner, blobId);
    expect(await fixture.objectKeys()).not.toContain(objectKey);
    const stored = await context.assets.read(owner, asset);
    expect(stored).not.toBeNull();
    expect((await new Response(stored!.body).arrayBuffer()).byteLength).toBe(0);
    await context.assets.remove(owner, blobId);
    expect((await pg.query('SELECT * FROM relay_verified_assets WHERE "objectKey" = $1', [objectKey])).rowCount).toBe(
      0,
    );
  } finally {
    await Promise.all([context.close(), pg.end()]);
  }
});

test("purging a resumed blob removes a multipart upload that later appeared at its old address", async () => {
  const context = await fixture.context();
  const pg = new Client({ connectionString: fixture.relayDatabaseUrl });
  const blobId = randomId("legacy-reservation");
  const owner = { projectKey: projectKey(context.scope.accountId, context.scope.workbenchId), blobId };
  const bytes = new Uint8Array([1, 2]);
  const asset = { sha256: sha256(bytes), byteLength: bytes.byteLength, mediaType: "application/octet-stream" };
  const oldKey = `assets/legacy/${blobId}`;
  try {
    await pg.connect();
    await pg.query(
      'INSERT INTO relay_asset_uploads ("ownerId", id, asset, "objectKey", "partSize", status) VALUES ($1, $2, $3, $4, $5, $6)',
      [await fingerprint(owner), blobId, asset, oldKey, multipartSize(bytes.byteLength), "open"],
    );
    const before = await fixture.multipartKeys();
    await context.assets.begin(owner, blobId, asset);
    await fixture.initiateMultipart(oldKey);
    const active = await fixture.multipartKeys();
    expect(active).toContain(oldKey);
    expect(active).toHaveLength(before.length + 2);
    await context.assets.remove(owner, blobId);
    expect(await fixture.multipartKeys()).toEqual(before);
  } finally {
    await Promise.all([context.close(), pg.end()]);
  }
});
