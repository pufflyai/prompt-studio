import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { applyRecordChange, blankRecord, storageRecordId } from "pstdio-sync";
import { fingerprint, type Mutation, type Scope, type Snapshot, sealMutation } from "pstdio-sync-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { createNativeRelayPeer } from "./native-relay-peer.fixture";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const createSnapshotWithFiles = async (input: {
  scope: Scope;
  environmentId: string;
  recordId: string;
  bytes: Uint8Array;
}) => {
  const { scope, bytes } = input;
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength,
    mediaType: "text/plain",
  };
  const documentId = storageRecordId(["artifact-file"], "documents/remote.txt");
  const blobId = storageRecordId(["blob-file"], "remote-attachment");
  const mutation = await sealMutation({
    protocolVersion: 2,
    epoch: "owned-wire-peer",
    generation: 0,
    sequence: 1,
    scope,
    environmentId: "remote-environment",
    operationId: "remote-save",
    parents: [],
    changes: [
      {
        recordId: input.recordId,
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "From the native connection" },
      },
      {
        recordId: documentId,
        expectedRevision: 0,
        baseDeleted: false,
        value: {
          expected: await fingerprint(null),
          next: {
            path: "documents/remote.txt",
            kind: "file",
            parent: JSON.stringify(["mount-root", "documents"]),
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        asset: { base: null, next: asset },
      },
      {
        recordId: blobId,
        expectedRevision: 0,
        baseDeleted: false,
        value: {
          expected: await fingerprint(null),
          next: {
            name: "attachment.txt",
            mimeType: "text/plain",
            scopeType: "project",
            scopeId: scope.workbenchId,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        asset: { base: null, next: asset },
      },
    ],
  });
  const checkpoint = { epoch: "owned-wire-peer", sequence: 1 };
  const snapshot: Snapshot = {
    protocolVersion: 2,
    generation: 0,
    covered: 0,
    writers: { "remote-environment": { floor: 0 }, [input.environmentId]: { floor: 0 } },
    documents: {},
    retainedBranches: [],
    scope,
    checkpoint,
    journalSequence: 1,
    publishedRevision: "published",
    records: Object.fromEntries(
      mutation.changes.map((change) => [change.recordId, applyRecordChange(blankRecord(change.recordId), change)]),
    ),
    receipts: {
      "remote-save": {
        order: 1,
        operationId: mutation.operationId,
        fingerprint: mutation.fingerprint,
        mutation,
        status: "accepted",
        checkpoint,
        recoveryProof: "a".repeat(64),
      },
    },
    conflicts: {},
  };
  return snapshot;
};

export const registerNativeRelaySmokeTests = () => {
  test(
    "compiled protocol 2 connection preserves frozen retries across restart and content across restore",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-native-relay-"));
      const source = join(root, "source");
      mkdirSync(source);
      const bundle = await Bun.build({
        entrypoints: [join(import.meta.dir, "fixtures/grouped-storage-extension.ts")],
        target: "bun",
      });
      if (!bundle.success) throw new AggregateError(bundle.logs, "Could not build the public SDK fixture");
      await Bun.write(join(source, "extension.js"), bundle.outputs[0]!);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "shared-notes",
          publisher: "example",
          version: "1.0.0",
          type: "module",
          main: "extension.js",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      const env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "shared-notes" }]) };
      let host = await startPackagedServe(root, env);
      const post = (path: string, body: unknown) =>
        fetch(`${host.baseUrl}/v1${path}`, {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      const read = async (projectId: string) => {
        const response = await post(
          `/projects/${projectId}/extensions/commands/example.shared-notes.command.read/execute`,
          { params: {} },
        );
        if (!response.ok) throw new Error("Public packaged storage read failed");
        const body = (await response.json()) as {
          outcome: { ok: boolean; value: { note: { recordId: string; revision: string; value: unknown } } };
        };
        expect(body.outcome.ok).toBe(true);
        return body.outcome.value.note;
      };
      let peer: ReturnType<typeof Bun.serve> | undefined;
      try {
        const response = await post("/projects", folderProjectInput({ name: "Native relay" }, root));
        expect(response.status).toBe(201);
        const project = (await response.json()) as { id: string };
        const initial = await read(project.id);
        const identity = (await (
          await fetch(`${host.baseUrl}/v1/environment`, { headers: runtimeAuthorization(host.descriptor) })
        ).json()) as { environmentId: string };
        const scope = { accountId: "owned-wire-peer", workbenchId: project.id, extensionId: "example.shared-notes" };
        const bytes = new TextEncoder().encode("Ordinary files from another environment");
        const snapshot = await createSnapshotWithFiles({
          scope,
          bytes,
          environmentId: identity.environmentId,
          recordId: initial.recordId,
        });
        // This owned protocol peer checks bundle wiring. Real manager/PostgreSQL/S3 behavior is tested separately.
        const restoredRead = Promise.withResolvers<void>();
        const firstSubmit = Promise.withResolvers<Mutation>();
        const retrySubmit = Promise.withResolvers<Mutation>();
        let restarting = false;
        peer = createNativeRelayPeer(
          snapshot,
          bytes,
          undefined,
          (observed) => {
            if (observed.checkpoint.epoch === "restored-peer") restoredRead.resolve();
          },
          (mutation) => {
            if (mutation.operationId === "frozen-retry") {
              if (restarting) retrySubmit.resolve(mutation);
              else firstSubmit.resolve(mutation);
            }
            return new Response(null, { status: 503 });
          },
        );
        const configPath = join(root, "relay.json");
        writeFileSync(
          configPath,
          JSON.stringify({
            connections: [
              {
                accountId: scope.accountId,
                workbenchId: scope.workbenchId,
                environmentId: identity.environmentId,
                managerOrigin: peer.url.origin,
                relayOrigin: peer.url.origin,
                renewalGrant: "owned-renewal-fixture",
              },
            ],
          }),
          { mode: 0o600 },
        );
        await stopProcess(host.child);
        host = await startPackagedServe(root, { ...env, PSTDIO_RELAY_CONFIG_FILE: configPath });
        while ((await read(project.id)).value !== "From the native connection") await Bun.sleep(20);
        expect((await read(project.id)).value).toBe("From the native connection");
        const filesResponse = await post(
          `/projects/${project.id}/extensions/commands/example.shared-notes.command.read-files/execute`,
          { params: {} },
        );
        const files = (await filesResponse.json()) as {
          outcome: { ok: boolean; value: { document: string; attachment: string; reference: { url: string } } };
        };
        if (!files.outcome.ok) throw new Error(JSON.stringify(files.outcome));
        expect(files.outcome.ok).toBe(true);
        expect(files.outcome.value.document).toBe(new TextDecoder().decode(bytes));
        expect(files.outcome.value.attachment).toBe(new TextDecoder().decode(bytes));
        const content = await fetch(`${host.baseUrl}${files.outcome.value.reference.url}`, {
          headers: runtimeAuthorization(host.descriptor),
        });
        expect(await content.text()).toBe(new TextDecoder().decode(bytes));
        const pendingValue = "Local pending edit";
        const localRecord = await read(project.id);
        const committed = await post(
          `/projects/${project.id}/extensions/commands/example.shared-notes.command.commit/execute`,
          {
            params: {
              group: {
                operationId: "frozen-retry",
                edits: [
                  {
                    recordId: localRecord.recordId,
                    expectedRevision: localRecord.revision,
                    replace: pendingValue,
                  },
                ],
              },
            },
          },
        );
        expect(committed.status).toBe(200);
        expect(((await committed.json()) as { outcome: { ok: boolean } }).outcome.ok).toBe(true);
        const frozen = await firstSubmit.promise;
        await stopProcess(host.child);
        restarting = true;
        host = await startPackagedServe(root, { ...env, PSTDIO_RELAY_CONFIG_FILE: configPath });
        expect(await retrySubmit.promise).toEqual(frozen);
        expect((await read(project.id)).value).toBe(pendingValue);
        await stopProcess(host.child);
        Object.assign(snapshot, {
          checkpoint: { epoch: "restored-peer", sequence: 0 },
          journalSequence: 0,
          records: {},
          receipts: {},
          conflicts: {},
        });
        host = await startPackagedServe(root, { ...env, PSTDIO_RELAY_CONFIG_FILE: configPath });
        await restoredRead.promise;
        expect(snapshot.receipts).toEqual({});
        expect((await read(project.id)).value).toBe(pendingValue);
        await stopProcess(host.child);
        await peer.stop(true);
        peer = undefined;
        host = await startPackagedServe(root, env);
        expect((await read(project.id)).value).toBe(pendingValue);
      } finally {
        await stopProcess(host.child);
        await peer?.stop(true);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
