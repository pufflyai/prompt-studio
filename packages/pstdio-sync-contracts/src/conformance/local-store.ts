import { PGlite } from "@electric-sql/pglite";
import { canonicalJson } from "../fingerprint";
import type { Snapshot } from "../state";
import type { Mutation, Scope } from "../wire";
import { emptySnapshot } from "./relay";

export interface LocalState {
  accepted: Snapshot;
  pending: Mutation[];
  blobs: Record<string, string>;
}
export async function createLocalStore(path: string) {
  let db = await PGlite.create(path);
  await db.exec("CREATE TABLE conformance_local (scope text PRIMARY KEY, state jsonb NOT NULL)");
  return {
    async transaction<T>(scope: Scope, change: (state: LocalState) => Promise<T>) {
      return db.transaction(async (tx) => {
        const key = canonicalJson(scope);
        const row = await tx.query<{ state: LocalState }>("SELECT state FROM conformance_local WHERE scope=$1", [key]);
        const state = row.rows[0]?.state ?? { accepted: emptySnapshot(scope), pending: [], blobs: {} };
        const value = await change(state);
        await tx.query("INSERT INTO conformance_local VALUES($1,$2) ON CONFLICT(scope) DO UPDATE SET state=$2", [
          key,
          state,
        ]);
        return value;
      });
    },
    async restart() {
      await db.close();
      db = await PGlite.create(path);
    },
    close: () => db.close(),
  };
}
export type LocalStore = Awaited<ReturnType<typeof createLocalStore>>;
