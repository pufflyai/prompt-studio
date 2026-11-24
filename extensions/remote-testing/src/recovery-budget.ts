import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";

type RecoveryKind = "cleanup" | "log" | "collector";
type Admission = { at: number; kind: RecoveryKind };
type Budget = { admissions: Admission[]; cursors?: Partial<Record<RecoveryKind, string>> };
type BudgetContext = Pick<ExtensionContextBase, "storage" | "automation" | "logger">;
const limits = { cleanup: 8, log: 8, collector: 4 };
export class RecoveryBudgetExhausted extends Error {}

// The host admits 60 jobs per rolling minute. Recovery uses at most 20, leaving
// headroom for direct launches and their lifecycle work, without changing host limits.
export async function reserveRecoveryAdmission(
  store: ExtensionStorageApi,
  kind: RecoveryKind,
  clock?: number,
  candidate?: string,
) {
  const budgets = store.collection<Budget>("recovery-admissions");
  while (true) {
    const now = clock ?? Date.now();
    const current = await budgets.read("rolling");
    const admissions = (current?.value.admissions ?? []).filter((entry) => entry.at > now - 60_000);
    if (admissions.length >= 20 || admissions.filter((entry) => entry.kind === kind).length >= limits[kind])
      return false;
    admissions.push({ at: now, kind });
    const value = { admissions, cursors: { ...current?.value.cursors, ...(candidate ? { [kind]: candidate } : {}) } };
    const saved = current
      ? await budgets.updateIfUnchanged("rolling", current.revision, value)
      : await budgets.createIfAbsent("rolling", value);
    if (saved) return true;
  }
}

export function budgetedRecovery(ctx: BudgetContext, kind: RecoveryKind) {
  return {
    ...ctx,
    automation: {
      ...ctx.automation,
      enqueue: async (input: Parameters<ExtensionContextBase["automation"]["enqueue"]>[0]) => {
        const params = input.input.params;
        const runId = typeof params?.runId === "string" ? params.runId : undefined;
        const candidate = kind === "cleanup" ? `${runId}:${params?.environmentId}` : runId;
        if (!(await reserveRecoveryAdmission(ctx.storage, kind, undefined, candidate)))
          throw new RecoveryBudgetExhausted("Recovery admission deferred.");
        return ctx.automation.enqueue(input);
      },
    },
  };
}

export async function recoveryCursor(store: ExtensionStorageApi, kind: RecoveryKind) {
  return (await store.collection<Budget>("recovery-admissions").get("rolling"))?.cursors?.[kind];
}

export async function recoveryOrder<T>(
  store: ExtensionStorageApi,
  kind: RecoveryKind,
  items: T[],
  key: (item: T) => string,
) {
  const cursor = await recoveryCursor(store, kind);
  const sorted = items.toSorted((a, b) => (key(a) < key(b) ? -1 : Number(key(a) > key(b))));
  return cursor
    ? [...sorted.filter((item) => key(item) > cursor), ...sorted.filter((item) => key(item) <= cursor)]
    : sorted;
}
