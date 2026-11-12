import type { CommandContext } from "@pstdio/sdk/extensions";
import type { QuotaLimit, QuotaReport } from "./quotas";

const hour = 3600000;
const retention = 8 * 24 * hour;
interface SavedSample {
  kind: "quota-sample";
  providerId: string;
  limitId: string;
  resetsAt: string | null;
  at: string;
  usedPercent: number;
}
interface SampleRecord {
  recordId: string;
  value: SavedSample;
}

const saveSample = async (storage: CommandContext["storage"], sample: SampleRecord, signal?: AbortSignal) => {
  for (;;) {
    signal?.throwIfAborted();
    const existing = await storage.records.read(sample.recordId);
    const value = existing.value as unknown as SavedSample | null;
    if (existing.exists && !existing.deleted && value && Date.parse(value.at) >= Date.parse(sample.value.at))
      return { recordId: sample.recordId, value };
    const outcome = await storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: [{ recordId: sample.recordId, replace: { ...sample.value }, expectedRevision: existing.revision }],
    });
    if (outcome.state === "refused") continue;
    if (outcome.state === "needs-attention") throw new Error("Could not save quota history.");
    return sample;
  }
};

// Each hourly observation is an independent record; concurrent checks never replace a whole history.
export const saveQuotaHistory = async (
  storage: CommandContext["storage"],
  reports: QuotaReport[],
  now = Date.now(),
  signal?: AbortSignal,
) => {
  const records = storage.records;
  const saved = (await records.list()).flatMap((record) => {
    const value = record.value as unknown as SavedSample | null;
    return value?.kind === "quota-sample" ? [{ recordId: record.recordId, value, revision: record.revision }] : [];
  });
  const current = reports.flatMap((report) =>
    report.status === "available"
      ? report.limits.map((limit) => ({
          recordId: records.id(
            `quota:${report.id}:${limit.id}:${limit.resetsAt ?? "unknown"}:${Math.floor(Date.parse(report.checkedAt) / hour)}`,
          ),
          value: {
            kind: "quota-sample" as const,
            providerId: report.id,
            limitId: limit.id,
            resetsAt: limit.resetsAt ?? null,
            at: report.checkedAt,
            usedPercent: 100 - limit.remainingPercent,
          },
        }))
      : [],
  );
  const written = await Promise.all(current.map((sample) => saveSample(storage, sample, signal)));
  const expired = saved.filter((sample) => Date.parse(sample.value.at) < now - retention);
  if (expired.length) {
    await records.commit({
      operationId: crypto.randomUUID(),
      edits: expired.map(({ recordId, revision }) => ({ recordId, deleted: true, expectedRevision: revision })),
    });
  }
  const samples = new Map(
    saved
      .filter((sample) => Date.parse(sample.value.at) >= now - retention)
      .map((sample) => [sample.recordId, sample.value]),
  );
  for (const sample of written) samples.set(sample.recordId, sample.value);
  return reports.map((report) => ({
    ...report,
    limits: report.limits.map((limit) => ({
      ...limit,
      history: [...samples.values()]
        .filter(
          (sample) =>
            sample.providerId === report.id &&
            sample.limitId === limit.id &&
            sample.resetsAt === (limit.resetsAt ?? null),
        )
        .map(({ at, usedPercent }) => ({ at, usedPercent }))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    })),
  }));
};

export const quotaSeries = (limit: QuotaLimit, checkedAt: string) => {
  const now = Date.parse(checkedAt);
  const reset = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN;
  const duration = (limit.windowMinutes ?? 0) * 60000;
  const periodStart = reset - duration;
  const knownPeriod = duration > 0 && Number.isFinite(reset) && periodStart <= now && reset > now;
  const observations = [
    ...(limit.history ?? []).filter((sample) => sample.at !== checkedAt),
    { at: checkedAt, usedPercent: 100 - limit.remainingPercent },
  ];
  const history = observations
    .filter((sample) => Date.parse(sample.at) <= now && (!knownPeriod || Date.parse(sample.at) >= periodStart))
    .map((sample) => ({ time: Date.parse(sample.at), used: sample.usedPercent }))
    .sort((a, b) => a.time - b.time);
  const start = knownPeriod ? periodStart : Math.min(history[0]?.time ?? now, now - hour);
  // Every series starts at zero visually; the anchor is never saved as an observation.
  if (history[0]?.time !== start || history[0]?.used !== 0) history.unshift({ time: start, used: 0 });
  const end = Number.isFinite(reset) && reset > now ? reset : now;
  const elapsed = now - start;
  const used = 100 - limit.remainingPercent;
  const forecast =
    knownPeriod && elapsed > 0
      ? [
          { time: now, used },
          { time: end, used: (used * duration) / elapsed },
        ]
      : [];
  return { history, forecast, start, end };
};
