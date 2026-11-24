import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";

type RecoveryKind = "cleanup" | "log" | "collector";
type Admission = { at: number; kind: RecoveryKind };
type BudgetContext = Pick<ExtensionContextBase, "storage" | "automation" | "logger">;
const limits = { cleanup: 8, log: 8, collector: 4 };
export class RecoveryBudgetExhausted extends Error {}

// The host admits 60 jobs per rolling minute. Recovery uses at most 20, leaving
// headroom for direct launches and their lifecycle work, without changing host limits.
export async function reserveRecoveryAdmission(store: ExtensionStorageApi, kind: RecoveryKind, clock?: number) {
  const budgets = store.collection<{ admissions: Admission[] }>("recovery-admissions");
  while (true) {
    const now = clock ?? Date.now();
    const current = await budgets.read("rolling");
    const admissions = (current?.value.admissions ?? []).filter((entry) => entry.at > now - 60_000);
    if (admissions.length >= 20 || admissions.filter((entry) => entry.kind === kind).length >= limits[kind])
      return false;
    admissions.push({ at: now, kind });
    const saved = current
      ? await budgets.updateIfUnchanged("rolling", current.revision, { admissions })
      : await budgets.createIfAbsent("rolling", { admissions });
    if (saved) return true;
  }
}

export function budgetedRecovery(ctx: BudgetContext, kind: RecoveryKind) {
  return {
    ...ctx,
    automation: {
      ...ctx.automation,
      enqueue: async (input: Parameters<ExtensionContextBase["automation"]["enqueue"]>[0]) => {
        if (!(await reserveRecoveryAdmission(ctx.storage, kind)))
          throw new RecoveryBudgetExhausted("Recovery admission deferred.");
        return ctx.automation.enqueue(input);
      },
    },
  };
}
