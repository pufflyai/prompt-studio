import { Pool } from "pg";
import { canonicalJson, validateMutation } from "../fingerprint";
import { type Receipt, type Snapshot, snapshotSchema } from "../state";
import type { Mutation, Scope } from "../wire";
import { own, put } from "./dictionary";
import type { TestObjects } from "./objects";
import { retainUncapturedAlternatives } from "./retain-alternatives";
import { stage } from "./staging";

export const emptySnapshot = (scope: Scope): Snapshot => ({
  protocolVersion: 2,
  generation: 0,
  covered: 0,
  writers: {},
  documents: {},
  retainedBranches: [],
  scope,
  journalSequence: 0,
  checkpoint: { epoch: "initial", sequence: 0 },
  records: {},
  receipts: {},
  conflicts: {},
  publishedRevision: "published-1",
});

export function recordOutcome(state: Snapshot, mutation: Mutation, staged: Awaited<ReturnType<typeof stage>>) {
  for (const conflict of Object.values(state.conflicts)) {
    if (!conflict.resolvedBy && mutation.changes.some((change) => conflict.recordIds.includes(change.recordId)))
      conflict.revision++;
  }
  let conflictId: string | undefined;
  if (staged.status === "accepted") {
    state.records = staged.records;
    state.checkpoint.sequence++;
    retainUncapturedAlternatives(state, mutation);
    for (const expected of mutation.resolution?.expectedConflicts ?? []) {
      const conflict = own(state.conflicts, expected.conflictId)!;
      conflict.resolvedBy = mutation.operationId;
    }
  } else {
    const root = mutation.resolution && own(state.conflicts, mutation.resolution.conflictId);
    conflictId = root && !root.resolvedBy ? root.conflictId : mutation.operationId;
    const existing = own(state.conflicts, conflictId);
    if (existing) existing.alternativeOperationIds.push(mutation.operationId);
    else
      put(state.conflicts, conflictId, {
        conflictId,
        revision: 1,
        recordIds: mutation.changes.map((change) => change.recordId),
        alternativeOperationIds: [mutation.operationId],
      });
  }
  return { status: staged.status, reason: staged.reason, conflictId };
}

const prepareWriter = (state: Snapshot, mutation: Mutation) => {
  if (mutation.epoch !== state.checkpoint.epoch || mutation.generation !== state.generation)
    throw new Error("Resynchronization required: preserve the original proposal");
  state.writers[mutation.environmentId] ??= { floor: 0 };
};

export async function createRelay(databaseUrl: string, objects: TestObjects) {
  const pool = new Pool({ connectionString: databaseUrl });
  // Test-only schema. Never pointed at the app database; no production migration.
  await pool.query("CREATE TABLE conformance_state (scope text PRIMARY KEY, state jsonb NOT NULL)");
  async function snapshot(scope: Scope) {
    const result = await pool.query("SELECT state FROM conformance_state WHERE scope=$1", [canonicalJson(scope)]);
    return snapshotSchema.parse(result.rows[0]?.state ?? emptySnapshot(scope));
  }
  async function submit(input: Mutation, crash?: "before-commit" | "after-commit") {
    const mutation = await validateMutation(input);
    const key = canonicalJson(mutation.scope);
    const connection = await pool.connect();
    let committed = false;
    try {
      await connection.query("BEGIN");
      await connection.query("INSERT INTO conformance_state VALUES($1,$2) ON CONFLICT DO NOTHING", [
        key,
        emptySnapshot(mutation.scope),
      ]);
      const result = await connection.query("SELECT state FROM conformance_state WHERE scope=$1 FOR UPDATE", [key]);
      const state = snapshotSchema.parse(result.rows[0].state);
      prepareWriter(state, mutation);
      const previous = own(state.receipts, mutation.operationId);
      if (previous && previous.fingerprint !== mutation.fingerprint)
        throw new Error("operation identity reused with changed content");
      if (previous && previous.status !== "pending") {
        await connection.query("COMMIT");
        committed = true;
        return previous;
      }
      const captured = new Set(mutation.resolution?.capturedOperationIds ?? []);
      const waiting = mutation.parents.some(
        (parent) => !captured.has(parent) && own(state.receipts, parent)?.status !== "accepted",
      );
      const missing = (
        await Promise.all(
          mutation.changes.map(
            async (change) => change.asset?.next && !(await objects.get(mutation.scope, change.asset.next)),
          ),
        )
      ).some(Boolean);
      let outcome: Pick<Receipt, "status" | "reason" | "conflictId">;
      if (waiting || missing)
        outcome = { status: "pending", reason: waiting ? "unaccepted dependency" : "incomplete assets" };
      else outcome = recordOutcome(state, mutation, await stage(state, mutation));
      const receipt: Receipt = {
        operationId: mutation.operationId,
        fingerprint: mutation.fingerprint,
        mutation,
        order: previous?.order ?? ++state.journalSequence,
        ...outcome,
        checkpoint: outcome.status === "accepted" ? { ...state.checkpoint } : null,
      };
      put(state.receipts, mutation.operationId, receipt);
      state.retainedBranches = Object.values(state.receipts)
        .filter((receipt) => receipt.status !== "accepted")
        .map((receipt) => receipt.operationId);
      await connection.query("UPDATE conformance_state SET state=$2 WHERE scope=$1", [key, state]);
      if (crash === "before-commit") throw new Error("crash before commit");
      await connection.query("COMMIT");
      committed = true;
      if (crash === "after-commit") throw new Error("crash after commit before acknowledgment");
      return receipt;
    } finally {
      if (!committed) await connection.query("ROLLBACK");
      connection.release();
    }
  }
  return {
    snapshot,
    submit,
    async restore(saved: Snapshot) {
      const state = snapshotSchema.parse({ ...saved, checkpoint: { ...saved.checkpoint, epoch: crypto.randomUUID() } });
      await pool.query("INSERT INTO conformance_state VALUES($1,$2) ON CONFLICT(scope) DO UPDATE SET state=$2", [
        canonicalJson(state.scope),
        state,
      ]);
    },
    async publish(scope: Scope, revision: string) {
      const state = await snapshot(scope);
      state.publishedRevision = revision;
      await pool.query("UPDATE conformance_state SET state=$2 WHERE scope=$1", [canonicalJson(scope), state]);
    },
    close: () => pool.end(),
  };
}
export type TestRelay = Awaited<ReturnType<typeof createRelay>>;
