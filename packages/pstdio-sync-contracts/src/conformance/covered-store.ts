import { Pool } from "pg";
import type { CheckpointGroup } from "../checkpoint";
import { canonicalJson } from "../fingerprint";
import type { Asset, Scope } from "../wire";
import { acknowledgeCovered } from "./covered-acknowledgement";
import { createDocumentBarrier } from "./covered-barrier";
import { submitCovered } from "./covered-publication";
import { compactCovered } from "./covered-retirement";
import { type CoveredState, newCoveredState } from "./covered-state";
import type { TestObjects } from "./objects";

// Reference owner only: transactions lock publication, coverage and deletion together.
export async function createCoveredStore(databaseUrl: string, objects: TestObjects) {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query("CREATE TABLE covered_state (scope text PRIMARY KEY, state jsonb NOT NULL)");
  async function transaction<T>(scope: Scope, action: (state: CoveredState) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO covered_state VALUES ($1,$2) ON CONFLICT DO NOTHING", [
        canonicalJson(scope),
        newCoveredState(scope),
      ]);
      const row = await client.query("SELECT state FROM covered_state WHERE scope=$1 FOR UPDATE", [
        canonicalJson(scope),
      ]);
      const state = row.rows[0].state as CoveredState;
      const result = await action(state);
      await client.query("UPDATE covered_state SET state=$2 WHERE scope=$1", [canonicalJson(scope), state]);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const snapshot = (scope: Scope) => transaction(scope, async (state) => structuredClone(state));
  async function pin(scope: Scope, assets: Asset[]) {
    return transaction(scope, async (state) => {
      for (const asset of assets) if (!(await objects.get(scope, asset))) throw new Error("incomplete pin");
      const id = crypto.randomUUID();
      state.pins[id] = assets;
      return id;
    });
  }

  return {
    transaction,
    snapshot,
    pin,
    submit: (scope: Scope, authenticated: string, input: CheckpointGroup, fault?: string) =>
      submitCovered(transaction, objects, scope, authenticated, input, fault),
    acknowledge: (scope: Scope, authenticated: string, input: unknown) =>
      acknowledgeCovered(transaction, scope, authenticated, input),
    compact: (scope: Scope, fault?: string, afterRetirement?: () => Promise<void>) =>
      compactCovered(transaction, objects, scope, fault, afterRetirement),
    ...createDocumentBarrier(transaction),
    close: () => pool.end(),
  };
}
export { snapshotHash } from "./covered-state";
export type CoveredStore = Awaited<ReturnType<typeof createCoveredStore>>;
