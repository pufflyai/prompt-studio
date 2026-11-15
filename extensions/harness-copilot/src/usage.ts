import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const FIELDS = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningTokens"] as const;
type Tokens = Record<(typeof FIELDS)[number], number>;
type Totals = { models: Map<string, Tokens>; nanoAiu: number };

export interface CopilotUsage extends Tokens {
  /** Start of the billing cycle the totals cover. Copilot cycles start on the 1st at 00:00 UTC. */
  since: string;
  /** Only sessions saved on this device are counted, including ones started outside Prompt Studio. */
  scope: "device";
  nanoAiu: number;
  models: ({ id: string } & Tokens)[];
}

const empty = (): Tokens => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
});

type ModelUsage = Partial<Tokens> | undefined;
type UsageRecord = {
  timestamp: string;
  data: {
    totalNanoAiu?: number;
    providerModelMetrics?: { modelId: string | null; metrics?: { usage?: ModelUsage } }[];
    modelMetrics?: Record<string, { usage?: ModelUsage } | undefined>;
  };
};

// Checkpoints and shutdown summaries carry the session's running totals, so the latest one wins.
const totalsOf = (record: UsageRecord): Totals => {
  const entries: [string, ModelUsage][] = record.data.providerModelMetrics
    ? record.data.providerModelMetrics.map((metric) => [metric.modelId ?? "unknown", metric.metrics?.usage])
    : Object.entries(record.data.modelMetrics ?? {}).map(([id, metric]) => [id, metric?.usage]);
  const models = new Map<string, Tokens>();
  for (const [id, usage] of entries) {
    const tokens = models.get(id) ?? empty();
    for (const field of FIELDS) tokens[field] += usage?.[field] ?? 0;
    models.set(id, tokens);
  }
  return { models, nanoAiu: record.data.totalNanoAiu ?? 0 };
};

/**
 * Usage this session added after `since`: its latest totals minus the totals it had already reached.
 * A fork starts with copies of its source's records, dated before the fork's own start, so those
 * count as already reached and are not counted twice.
 */
const readSession = async (file: string, since: number) => {
  let before: Totals | undefined;
  let latest: Totals | undefined;
  let cutoff = since;
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of lines) {
    const start = line.startsWith('{"type":"session.start"');
    if (!start && !line.includes('"session.usage_checkpoint"') && !line.includes('"session.shutdown"')) continue;
    let record: UsageRecord;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // A session being written can end in a partial line.
    }
    if (start) {
      cutoff = Math.max(since, Date.parse(record.timestamp) || since);
      continue;
    }
    const totals = totalsOf(record);
    if (Date.parse(record.timestamp) < cutoff) before = totals;
    else latest = totals;
  }
  if (!latest) return undefined;
  for (const [id, tokens] of latest.models) {
    const prior = before?.models.get(id);
    if (prior) for (const field of FIELDS) tokens[field] = Math.max(0, tokens[field] - prior[field]);
  }
  latest.nanoAiu = Math.max(0, latest.nanoAiu - (before?.nanoAiu ?? 0));
  return latest;
};

// Home refreshes quotas often; only sessions that changed since the last read are read again.
const cache = new Map<string, { key: string; totals: Totals | undefined }>();

const readCachedSession = async (file: string, since: number, info: { mtimeMs: number; size: number }) => {
  const key = `${since}:${info.mtimeMs}:${info.size}`;
  const cached = cache.get(file);
  if (cached?.key === key) return cached.totals;
  const totals = await readSession(file, since).catch(() => undefined);
  cache.set(file, { key, totals });
  return totals;
};

const copyTotals = (totals: Totals): Totals => ({
  nanoAiu: totals.nanoAiu,
  models: new Map([...totals.models].map(([id, tokens]) => [id, { ...tokens }])),
});

export const cycleStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export const readCopilotUsage = async (options: { home?: string; now?: Date } = {}): Promise<CopilotUsage> => {
  const home = options.home ?? process.env.COPILOT_HOME ?? join(homedir(), ".copilot");
  const since = cycleStart(options.now);
  const root = join(home, "session-state");
  const sessions = await readdir(root).catch(() => []);
  const models = new Map<string, Tokens>();
  let nanoAiu = 0;
  for (const session of sessions) {
    const file = join(root, session, "events.jsonl");
    const info = await stat(file).catch(() => undefined);
    // A session untouched since the cycle began cannot have used tokens in it.
    if (!info || info.mtimeMs < since.getTime()) continue;
    const cached = await readCachedSession(file, since.getTime(), info);
    if (!cached) continue;
    const totals = copyTotals(cached);
    nanoAiu += totals.nanoAiu;
    for (const [id, tokens] of totals.models) {
      const sum = models.get(id) ?? empty();
      for (const field of FIELDS) sum[field] += tokens[field];
      models.set(id, sum);
    }
  }
  const total = empty();
  for (const tokens of models.values()) for (const field of FIELDS) total[field] += tokens[field];
  return {
    since: since.toISOString(),
    scope: "device",
    ...total,
    nanoAiu,
    models: [...models]
      .map(([id, tokens]) => ({ id, ...tokens }))
      .filter((model) => FIELDS.some((field) => model[field] > 0))
      .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)),
  };
};
