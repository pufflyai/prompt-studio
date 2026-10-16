import type { RecordEdit } from "../authoring";
import type { Scope } from "../wire";
import { edit, resolve, working } from "./client-model";
import { visible } from "./documents";
import type { LocalStore } from "./local-store";
import type { TestObjects } from "./objects";
import type { TestRelay } from "./relay";
import { type SyncOptions, synchronize } from "./synchronize";

export function createClient(
  scope: Scope,
  environmentId: string,
  store: LocalStore,
  relay: TestRelay,
  objects: TestObjects,
) {
  return {
    edit: (edits: RecordEdit[]) => store.transaction(scope, (state) => edit(state, scope, environmentId, edits)),
    resolve: (
      conflictId: string,
      choose: "local" | "remote",
      handler?: { publishedRevision: string; handlerId: string },
    ) => store.transaction(scope, (state) => resolve(state, scope, environmentId, conflictId, choose, handler)),
    asset: (text: string) =>
      store.transaction(scope, async (state) => {
        const bytes = new TextEncoder().encode(text);
        const asset = {
          sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
          byteLength: bytes.length,
          mediaType: "image/png",
        };
        state.blobs[asset.sha256] = Buffer.from(bytes).toString("base64");
        return asset;
      }),
    state: () =>
      store.transaction(scope, async (state) => ({
        ...structuredClone(state),
        records: Object.fromEntries(
          Object.entries(state.accepted.records).map(([id, record]) => [id, visible(record)]),
        ),
        working: Object.fromEntries(Object.entries(working(state)).map(([id, record]) => [id, visible(record)])),
      })),
    sync: (options: SyncOptions = {}) =>
      store.transaction(scope, (state) => synchronize(state, scope, relay, objects, options)),
    restart: () => store.restart(),
  };
}
export type TestClient = ReturnType<typeof createClient>;
