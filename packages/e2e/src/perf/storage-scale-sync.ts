import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { type Background, contract, createRow } from "storage-scale-fixture";
import { scaleBackgroundOwner } from "./storage-scale-background";
import { attachScaleRuntime, type ScaleFixture, type ScaleRuntime } from "./storage-scale-runtime";
import { readScaleSyncService } from "./storage-scale-sync-service";
import { waitScaleSynced } from "./storage-scale-sync-setup";

// Attaches to the prepared sync service. Its relay and second device are already synced, so the
// measured case pays no initial upload, download or extension installation.
export const attachScaleSyncFixture = (home: string, fixture: ScaleFixture, emit: (row: object) => void) => {
  const service = readScaleSyncService(home);
  const remote = attachScaleRuntime(service.remote.descriptor, service.remote.baseUrl);
  const control = async <T>(path: string, method = "GET") => {
    const response = await fetch(`${service.control}${path}`, { method });
    if (!response.ok) throw new Error(`Sync service ${path}: HTTP ${response.status}`);
    return (await response.json()) as T;
  };
  const peer = {
    reads: () => control<number>("/reads"),
    states: () => control<unknown>("/states"),
    announceUnchanged: () => control("/announce-unchanged", "POST"),
  };
  const environment = service.environment;
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
    const initialReads = await peer.reads();
    for (let index = 0; index < count; index++) {
      if (index > 0) await Bun.sleep(Math.max(0, offeredAt + index * contract.incoming.intervalMs - performance.now()));
      const nonce = randomUUID();
      const row = { ...createRow(fixture.kind, ownerIndex, 83, 3), title: `Incoming ${nonce}` };
      let operation: Promise<unknown>;
      if (background === "noop-sync") {
        const before = await peer.reads();
        await peer.announceUnchanged();
        operation = (async () => {
          while ((await peer.reads()) === before) await Bun.sleep(10);
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
      assert(final.value, "The remote device lost the background row");
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
      assert.deepEqual(received.value, restored);
    }
    return {
      background,
      offered: count,
      completed,
      failed,
      intervalMs: contract.incoming.intervalMs,
      depths,
      drainedAtMs,
      peerStates: await peer.states(),
      relayReads: (await peer.reads()) - initialReads,
      controllerMemoryAfter: process.memoryUsage(),
      runtimeMemoryAfter: null,
      overlap: "attempted-unverified",
      receiverDrain: "synced status plus exact final value readback",
      foldPhaseObserved: false,
      layerQueueDepth: null,
      queueMetric: "driver requests; runtime queues remain uninstrumented",
    };
  };
  return { environment, begin, remote, preparedMs: service.preparedMs };
};
