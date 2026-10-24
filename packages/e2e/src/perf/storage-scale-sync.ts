import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type Background, contract, createRow } from "storage-scale-fixture";
import { createPackagedSyncPeer } from "../packaged/packaged-sync-relay.fixture";
import { scaleBackgroundOwner } from "./storage-scale-background";
import { configuredContainer } from "./storage-scale-container";
import { plannerValue } from "./storage-scale-extension";
import type { ScaleFixture, ScaleRuntime } from "./storage-scale-runtime";
import { prepareScaleSyncDevices, waitScaleSynced } from "./storage-scale-sync-setup";

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
    "subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:host.docker.internal",
  ]);
  if (generated.exitCode !== 0) throw new Error("Creating isolated sync certificate failed");
  const container = configuredContainer(home);
  const peer = createPackagedSyncPeer(
    { key: Bun.file(key), cert: Bun.file(cert) },
    container ? "0.0.0.0" : "127.0.0.1",
  );
  const environment = { NODE_EXTRA_CA_CERTS: cert };
  const remoteHome = `${home}-remote-${randomUUID()}`;
  const port = new URL(peer.origin).port;
  const origins = {
    primary: container ? `https://host.docker.internal:${port}` : peer.origin,
    remote: `https://127.0.0.1:${port}`,
  };
  const remote = await prepareScaleSyncDevices(home, remoteHome, fixture, environment, origins, emit).catch(
    async (error) => {
      await peer.stop();
      rmSync(remoteHome, { recursive: true, force: true });
      throw error;
    },
  );
  const begin = async (runtime: ScaleRuntime, background: Background, foregroundOperation: string) => {
    const offeredAt = performance.now();
    const owner = scaleBackgroundOwner(fixture.kind, foregroundOperation, background);
    const ownerIndex = owner.index;
    const scope = { planner: ownerIndex === 9, count: owner.rows };
    const count = background === "fold" ? 129 : contract.incoming.operations;
    const pending: Promise<unknown>[] = [];
    const depths: { atMs: number; offered: number; completed: number }[] = [];
    let completed = 0;
    let failed = 0;
    const initialReads = peer.reads();
    for (let index = 0; index < count; index++) {
      if (index > 0) await Bun.sleep(Math.max(0, offeredAt + index * contract.incoming.intervalMs - performance.now()));
      const nonce = randomUUID();
      const row = { ...createRow(fixture.kind, ownerIndex, 83, 3), title: `Incoming ${nonce}` };
      let operation: Promise<unknown>;
      if (background === "noop-sync") {
        const before = peer.reads();
        peer.announceUnchanged();
        operation = (async () => {
          while (peer.reads() === before) await Bun.sleep(10);
          await waitScaleSynced(runtime, fixture.projectId);
        })();
      } else
        operation = (background === "fold" ? runtime : remote).execute(fixture.projectId, owner.id, "scale", {
          input: { action: "commit", operationId: nonce, rows: [row], ...scope },
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
    await waitScaleSynced(remote, fixture.projectId);
    await waitScaleSynced(runtime, fixture.projectId);
    if (background !== "noop-sync") {
      const final = await remote.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: createRow(fixture.kind, ownerIndex, 83, 3).id, ...scope },
      });
      const received = await runtime.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: createRow(fixture.kind, ownerIndex, 83, 3).id, ...scope },
      });
      assert.deepEqual(received.value, final.value);
    }
    const drainedAtMs = performance.now() - offeredAt;
    if (background !== "noop-sync")
      await remote.execute(fixture.projectId, owner.id, "scale", {
        input: {
          action: "commit",
          operationId: randomUUID(),
          rows: [createRow(fixture.kind, ownerIndex, 83, 3)],
          ...scope,
        },
      });
    await waitScaleSynced(remote, fixture.projectId);
    await waitScaleSynced(runtime, fixture.projectId);
    if (background !== "noop-sync") {
      const received = await runtime.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: createRow(fixture.kind, ownerIndex, 83, 3).id, ...scope },
      });
      const restored = createRow(fixture.kind, ownerIndex, 83, 3);
      assert.deepEqual(received.value, scope.planner ? plannerValue(restored, owner.rows) : restored);
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
      relayReads: peer.reads() - initialReads,
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
      try {
        await remote.stop();
      } finally {
        await peer.stop();
        rmSync(remoteHome, { recursive: true, force: true });
      }
    },
  };
};
