import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { applyRecordChange, blankRecord, storageRecordId } from "pstdio-sync";
import { fingerprint, sealMutation } from "pstdio-sync-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { discoveryPeer } from "./discovery-peer.fixture";
import { startRelayRuntime } from "./runtime";

const until = async (condition: () => Promise<boolean>) => {
  const deadline = Date.now() + 2000;
  while (!(await condition()) && Date.now() < deadline) await Bun.sleep(10);
  expect(await condition()).toBe(true);
};

test("a read-only workspace keeps receiving structured storage without creating artifact folders", async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-read-only-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const app = await createTestApp();
  const wire = discoveryPeer("account");
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  try {
    const project = (await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Read only" })),
      })
    ).json()) as { id: string };
    const workspace = (await app.deps.workspaceService.getDefault(project.id))!;
    await app.deps.workspaceService.updateProviderProjection(workspace.id, {
      provider_capabilities_json: { ...workspace.provider_capabilities_json, files: "read" },
    });
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "documents",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(source, "extension.ts"),
      'export default {artifactMounts:[{id:"documents",path:"documents",label:"Documents",ref:{kind:"artifact-mount",id:"documents"}}]};',
    );
    const enabled = await app.app.request(`/v1/projects/${project.id}/extensions/installed/documents/enable`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        extensionId: "example.documents",
        name: "documents",
        sourcePath: source,
        sourceKind: "local_path",
        displayName: "Documents",
        manifest: { id: "example.documents", name: "documents" },
      }),
    });
    expect(enabled.status).toBe(200);
    const environment = await app.deps.environmentService.get();
    const path = join(root, "relay.json");
    await writeFile(
      path,
      JSON.stringify({
        connections: [
          {
            accountId: "account",
            workbenchId: project.id,
            environmentId: environment.environmentId,
            relayOrigin: wire.peer.url.origin,
            managerOrigin: wire.peer.url.origin,
            renewalGrant: "owned-grant",
          },
        ],
      }),
    );
    runtime = await startRelayRuntime({ path, environment: app.deps.environmentService, deps: app.deps });
    await until(async () => wire.connected().includes("example.documents"));
    const snapshot = wire.snapshots.get(JSON.stringify([project.id, "example.documents"]))!;
    const owner = { workbenchId: project.id, extensionId: "example.documents" };
    const local = await app.deps.extensionStorageService.open({ owner });
    const publish = async (recordId: string, value: Record<string, string>) => {
      const sequence = snapshot.journalSequence + 1;
      const checkpoint = { epoch: snapshot.checkpoint.epoch, sequence };
      const mutation = await sealMutation({
        protocolVersion: 1,
        scope: snapshot.scope,
        environmentId: "remote",
        operationId: crypto.randomUUID(),
        parents: [],
        changes: [
          {
            recordId,
            expectedRevision: 0,
            baseDeleted: false,
            value: { expected: await fingerprint(null), next: value },
          },
        ],
      });
      snapshot.records[recordId] = applyRecordChange(blankRecord(recordId), mutation.changes[0]!);
      snapshot.receipts[mutation.operationId] = {
        order: sequence,
        operationId: mutation.operationId,
        mutation,
        fingerprint: mutation.fingerprint,
        status: "accepted",
        checkpoint,
      };
      snapshot.journalSequence = sequence;
      snapshot.checkpoint = checkpoint;
      wire.wake();
    };
    const directory = storageRecordId(["artifact-file"], "documents/incoming");
    await publish(directory, {
      path: "documents/incoming",
      kind: "directory",
      id: "incoming-directory",
      parent: JSON.stringify(["mount-root", "documents"]),
    });
    await until(async () => (await local.records.read(directory)).exists);
    const record = storageRecordId(["project", project.id, "kv"], "message");
    await publish(record, { message: "structured data still arrives" });
    await until(async () => (await local.records.read(record)).exists);
    expect((await local.records.read(record)).value).toEqual({ message: "structured data still arrives" });
    expect(
      await stat(join(workspace.root_path!, ".pstdio/extension-storage/documents/documents")).catch(() => null),
    ).toBeNull();
  } finally {
    await runtime?.close();
    await wire.peer.stop(true);
    await app.close();
    await rm(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
  }
});
