import { openState, type SyncSpace, sealState } from "pstdio-sync/encryption";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import { type createIndexState, indexEntrySchema, indexLogName } from "./index-state";
import { batchLines } from "./log-entries";
import { publishLogUpdate, readLogUpdate } from "./log-updates";

/** The running device alone writes this log. Rows and cursor persist together before advancing. */
export const createIndexSync = (state: ReturnType<typeof createIndexState>) => {
  const stateIds = new Map<string, string | null>();
  const snapshotAt = new Map<string, number>();
  const initialized = new Set<string>();
  const restore = async (
    deviceId: string,
    id: string,
    space: SyncSpace,
    target: DocumentRelay,
    snapshot: StateInfo,
  ) => {
    const bytes = await openState(space, id, snapshot, await target.state(snapshot));
    const entries = indexEntrySchema.array().parse(JSON.parse(new TextDecoder().decode(bytes)));
    const removed = [...(state.devices.get(deviceId)?.values() ?? [])].map((entry) => ({ ...entry, value: null }));
    await state.save(deviceId, snapshot.through, [...removed, ...entries]);
  };
  const applyUpdates = async (
    deviceId: string,
    id: string,
    space: SyncSpace,
    target: DocumentRelay,
    updates: StoredUpdate[],
    after: number,
  ) => {
    for (const update of updates) {
      if (update.sequence <= after) continue;
      const entries = (await readLogUpdate(space, id, target, update)).map((line) =>
        indexEntrySchema.parse(JSON.parse(line)),
      );
      await state.save(deviceId, update.sequence, entries);
      after = update.sequence;
    }
    return after;
  };
  const read = async (deviceId: string, id: string, space: SyncSpace, target: DocumentRelay) => {
    let after = state.positions.get(deviceId) ?? 0;
    while (true) {
      const page = await target.read(after);
      const snapshot = page.state;
      stateIds.set(deviceId, snapshot?.stateId ?? null);
      snapshotAt.set(deviceId, snapshot?.through ?? 0);
      if (snapshot && snapshot.through > after) {
        await restore(deviceId, id, space, target, snapshot);
        after = snapshot.through;
        if (page.status === "state-required") continue;
      }
      if (page.status !== "updates") throw new Error("Device index snapshot unavailable");
      after = await applyUpdates(deviceId, id, space, target, page.updates, after);
      if (!page.more) return;
    }
  };
  const snapshot = async (deviceId: string, id: string, space: SyncSpace, target: DocumentRelay) => {
    const after = state.positions.get(deviceId) ?? 0;
    if (after - (snapshotAt.get(deviceId) ?? 0) < 1000) return;
    const saved = await sealState(space, id, {
      baseStateId: stateIds.get(deviceId) ?? null,
      through: after,
      state: new TextEncoder().encode(JSON.stringify([...(state.devices.get(deviceId)?.values() ?? [])])),
      summary: new Uint8Array(),
      blobIds: [],
    });
    try {
      if (!(await target.replace(saved))) {
        initialized.delete(deviceId);
        return;
      }
    } catch (error) {
      // The relay may have committed a snapshot whose acknowledgement never reached us.
      initialized.delete(deviceId);
      throw error;
    }
    stateIds.set(deviceId, saved.stateId);
    snapshotAt.set(deviceId, after);
  };
  return async (deviceId: string, own: boolean, space: SyncSpace, relay: (id: string) => DocumentRelay) => {
    await state.loaded;
    const id = await space.documentId(indexLogName(deviceId));
    const target = relay(id);
    if (!own || !initialized.has(deviceId)) {
      await read(deviceId, id, space, target);
      initialized.add(deviceId);
    }
    const queued = state.pending.get(deviceId);
    if (!own || !queued?.size) return;
    const pending = new Map(queued);
    for (const lines of batchLines([...pending.values()].map((entry) => JSON.stringify(entry)))) {
      const result = await publishLogUpdate(space, id, target, lines);
      await state.save(
        deviceId,
        result.sequence,
        lines.map((line) => indexEntrySchema.parse(JSON.parse(line))),
      );
    }
    for (const [key, entry] of pending) if (queued.get(key) === entry) queued.delete(key);
    if (!queued.size) state.pending.delete(deviceId);
    await snapshot(deviceId, id, space, target);
  };
};
