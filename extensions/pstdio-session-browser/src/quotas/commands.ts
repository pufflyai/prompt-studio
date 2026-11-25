import { commandRef, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { type SavedSample, saveQuotaHistory } from "./quota-history";
import { readQuotas } from "./quotas";

const legacyHistory = commandRef<Record<string, never>, SavedSample[]>({
  extensionId: "pstdio.home",
  id: "quota-history",
});

export const quotas = defineCommand({
  id: "quotas",
  title: l10n("quotas.read", "Read agent quotas"),
  cli: true,
  async run(ctx) {
    const [reports, history] = await Promise.all([
      readQuotas(ctx),
      ctx.commands.execute(legacyHistory, { params: {} }),
    ]);
    ctx.signal?.throwIfAborted();
    if (!history.ok && history.code !== "command_not_found") throw new Error(history.reason);
    return saveQuotaHistory(ctx.storage, reports, Date.now(), ctx.signal, history.ok ? history.value : []);
  },
});
