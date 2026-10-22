import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { type Background, contract, createRow, owners, workload } from "storage-scale-fixture";
import { folderProjectInput } from "../helpers/folder-project";
import { createPackagedSyncPeer } from "../packaged/packaged-sync-relay.fixture";
import { type ScaleFixture, type ScaleRuntime, startScaleRuntime } from "./storage-scale-runtime";

const signIn = async (runtime: ScaleRuntime, origin: string) => {
  const login = await runtime.client.account.login(origin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-use");
  assert((await fetch(callback)).ok);
};

const waitSynced = async (runtime: ScaleRuntime, projectId: string) => {
  while ((await runtime.client.account.projectSyncStatus(projectId)).state !== "synced") await Bun.sleep(25);
};

export const createScaleSyncFixture = async (home: string, fixture: ScaleFixture, emit: (row: object) => void) => {
  const root = join(home, "sync-fixture");
  mkdirSync(root, { recursive: true });
  const key = join(root, "peer-key.pem");
  const cert = join(root, "peer-cert.pem");
  const generated = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=IP:127.0.0.1,DNS:localhost",
  ]);
  if (generated.exitCode !== 0) throw new Error("Creating isolated sync certificate failed");
  const peer = createPackagedSyncPeer({ key: Bun.file(key), cert: Bun.file(cert) });
  const environment = { NODE_EXTRA_CA_CERTS: cert };
  const primary = await startScaleRuntime(home, environment);
  const remoteHome = `${home}-remote-${randomUUID()}`;
  mkdirSync(join(remoteHome, "project"), { recursive: true });
  const remote = await startScaleRuntime(remoteHome, environment);
  try {
    const started = performance.now();
    await signIn(primary, peer.origin);
    await primary.client.account.syncProject(fixture.projectId);
    await waitSynced(primary, fixture.projectId);
    await signIn(remote, peer.origin);
    const { environmentId } = await remote.client.runtime.environment();
    const folder = join(remoteHome, "project");
    await remote.client.projects.bindEnvironment(fixture.projectId, {
      environmentId,
      name: "Scale remote",
      initial_workspace: folderProjectInput({}, folder).initial_workspace,
    });
    for (const owner of owners(workload(fixture.kind))) {
      const name = owner.index === 9 ? "pstdio-planner" : `scale-owner-${owner.index}`;
      const source = join(home, "sources", owner.index === 9 ? "planner-source" : name);
      const relative = `.pstdio/extensions/${name}`;
      cpSync(source, join(folder, relative), { recursive: true, filter: (path) => basename(path) !== "node_modules" });
      await remote.client.extensions.install(fixture.projectId, {
        source: { kind: "project-folder", path: relative },
        installName: name,
      });
    }
    await waitSynced(remote, fixture.projectId);
    emit({
      phase: "initial-remote-download",
      durationMs: performance.now() - started,
      owners: 10,
      liveRows: owners(workload(fixture.kind)).reduce((sum, owner) => sum + owner.rows, 0),
      startupOutsideNavigation: true,
    });
  } catch (error) {
    await remote.stop();
    await peer.stop();
    throw error;
  } finally {
    await primary.stop();
  }
  const begin = async (runtime: ScaleRuntime, background: Background) => {
    const offeredAt = performance.now();
    const ownerIndex = background === "other-owner-catchup" ? 1 : 0;
    const owner = owners(workload(fixture.kind))[ownerIndex];
    const count = background === "fold" ? 129 : contract.incoming.operations;
    const pending: Promise<unknown>[] = [];
    const depths: { atMs: number; offered: number; completed: number }[] = [];
    let completed = 0;
    let failed = 0;
    for (let index = 0; index < count; index++) {
      if (index > 0) await Bun.sleep(Math.max(0, offeredAt + index * contract.incoming.intervalMs - performance.now()));
      const nonce = randomUUID();
      const row = { ...createRow(fixture.kind, ownerIndex, 83, 3), title: `Incoming ${nonce}` };
      let operation: Promise<unknown>;
      if (background === "noop-sync") operation = runtime.client.account.projectSyncStatus(fixture.projectId);
      else
        operation = (background === "fold" ? runtime : remote).execute(fixture.projectId, owner.id, "scale", {
          input: { action: "commit", operationId: nonce, rows: [row] },
        });
      pending.push(
        operation.then(
          () => {
            completed++;
          },
          () => {
            failed++;
          },
        ),
      );
      depths.push({ atMs: performance.now() - offeredAt, offered: index + 1, completed });
      emit({
        phase: "background-progress",
        background,
        owner: owner.id,
        atMs: performance.now() - offeredAt,
        offered: index + 1,
        completed,
        failed,
      });
    }
    await Promise.all(pending);
    await waitSynced(remote, fixture.projectId);
    await waitSynced(runtime, fixture.projectId);
    if (background !== "noop-sync") {
      const final = await remote.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: createRow(fixture.kind, ownerIndex, 83, 3).id },
      });
      const received = await runtime.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: createRow(fixture.kind, ownerIndex, 83, 3).id },
      });
      assert.deepEqual(received.value, final.value);
    }
    const drainedAtMs = performance.now() - offeredAt;
    if (background !== "noop-sync")
      await remote.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "commit", operationId: randomUUID(), rows: [createRow(fixture.kind, ownerIndex, 83, 3)] },
      });
    await waitSynced(remote, fixture.projectId);
    await waitSynced(runtime, fixture.projectId);
    if (background !== "noop-sync") {
      const received = await runtime.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: createRow(fixture.kind, ownerIndex, 83, 3).id },
      });
      assert.deepEqual(received.value, createRow(fixture.kind, ownerIndex, 83, 3));
    }
    return {
      background,
      offered: count,
      completed,
      failed,
      intervalMs: contract.incoming.intervalMs,
      depths,
      drainedAtMs,
      peerStates: peer.states(),
      controllerMemoryAfter: process.memoryUsage(),
      runtimeMemoryAfter: null,
      overlap: "attempted-unverified",
      receiverDrain: "synced status plus exact final value readback",
      foldPhaseObserved: false,
      layerQueueDepth: null,
      queueMetric: "driver requests; runtime queues remain uninstrumented",
    };
  };
  return {
    environment,
    begin,
    remote,
    peer,
    close: async () => {
      await remote.stop();
      await peer.stop();
    },
  };
};
