import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { type CopilotClientFactory, createCopilotClient, type QuotaSnapshot, withCopilotClient } from "./client";
import { type CopilotUsage, readCopilotUsage } from "./usage";

const LABELS: Record<string, string> = {
  premium_interactions: "Premium requests",
  chat: "Chat",
  completions: "Completions",
};

const count = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

const usageSentence = (usage: CopilotUsage) =>
  `This device used ${count.format(usage.inputTokens)} input and ${count.format(usage.outputTokens)} output tokens since ${day.format(new Date(usage.since))}.`;

/** Home's quota snapshot, plus local token use for plans whose budget Copilot does not report. */
export interface CopilotQuotaReport {
  status: "available" | "unavailable" | "unsupported";
  checkedAt: string;
  limits: { id: string; label: string; remainingPercent: number; resetsAt?: string }[];
  message?: string;
  usage?: CopilotUsage;
}

export const normalizeCopilotQuotas = (
  snapshots: Record<string, QuotaSnapshot | undefined>,
  usage?: CopilotUsage,
): CopilotQuotaReport => {
  const limits = Object.entries(snapshots).flatMap(([id, snapshot]) =>
    snapshot && !snapshot.isUnlimitedEntitlement
      ? [
          {
            id,
            label: LABELS[id] ?? id,
            remainingPercent: Math.max(0, Math.min(100, snapshot.remainingPercentage)),
            ...(Number.isFinite(Date.parse(snapshot.resetDate ?? ""))
              ? { resetsAt: new Date(snapshot.resetDate!).toISOString() }
              : {}),
          },
        ]
      : [],
  );
  const used = usage ? { usage } : {};
  if (limits.length) return { status: "available", checkedAt: new Date().toISOString(), limits, ...used };
  // Token-billed plans report request buckets as unlimited, and GitHub does not expose their credit budget.
  // Without a limit there is no remaining percentage, so report what this device used instead.
  const tokenBilled = Object.values(snapshots).some(
    (snapshot) => (snapshot as { tokenBasedBilling?: boolean })?.tokenBasedBilling,
  );
  const reason = tokenBilled
    ? "Copilot does not report a token budget for this plan; see github.com/settings/billing."
    : "This Copilot plan reports no limited quotas.";
  return {
    status: tokenBilled ? "unsupported" : "unavailable",
    checkedAt: new Date().toISOString(),
    limits,
    message: usage ? `${usageSentence(usage)} ${reason}` : reason,
    ...used,
  };
};

export const createQuotasCommand = (
  factory: CopilotClientFactory = createCopilotClient,
  readUsage: () => Promise<CopilotUsage> = readCopilotUsage,
) =>
  defineCommand({
    id: "quotas",
    title: l10n("quotas.title", "Inspect account quotas"),
    description: l10n("quotas.description", "Show GitHub Copilot quotas and this month's token use."),
    cli: true,
    run: async (ctx) => {
      const [snapshots, usage] = await Promise.allSettled([
        withCopilotClient(factory, { signal: ctx.signal }, (client) => client.getQuota()),
        readUsage(),
      ]);
      const used = usage.status === "fulfilled" ? usage.value : undefined;
      if (snapshots.status === "fulfilled") return normalizeCopilotQuotas(snapshots.value, used);
      ctx.signal?.throwIfAborted();
      // Still show this device's token use when Copilot cannot report quotas, for example when signed out.
      return {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
        limits: [],
        message: used
          ? `${usageSentence(used)} Copilot could not report quotas; check that you are signed in.`
          : "Copilot could not report quotas; check that you are signed in.",
        ...(used ? { usage: used } : {}),
      } satisfies CopilotQuotaReport;
    },
  });
