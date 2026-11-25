import type { CommandContext } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { acquireQuery } from "./limits";
import {
  checks,
  connectionId,
  environment,
  lanes,
  type Panel,
  type Point,
  panelDefinitions,
  type Snapshot,
  type State,
  visible,
  windows,
} from "./model";
import { expressions } from "./queries";

export const inputSchema = z.object({
  range: z.enum(["1h", "24h", "7d"]).default("24h"),
  section: z.enum(["Overview", "Sync", "Storage", "Infrastructure", "Failures"]).default("Overview"),
});
const sample = z.tuple([z.number().finite(), z.string().max(64)]);
const resultSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    result: z
      .array(
        z.object({
          metric: z.record(z.string(), z.string().max(128)),
          values: z.array(sample).max(1200).optional(),
          value: sample.optional(),
        }),
      )
      .max(50),
  }),
});
type Series = z.infer<typeof resultSchema>["data"]["result"];
const stateFor = (value: string | undefined): State =>
  (
    ({ "1": "ok", "2": "warning", "0": "critical", "-2": "not-configured", "-3": "unsupported" }) as Record<
      string,
      State
    >
  )[value ?? ""] ?? "unknown";

const localOnly = async (ctx: CommandContext) => {
  const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : await ctx.workspaces.getDefault();
  const source = ctx.invocation.source ?? ctx.source;
  const mode = ctx.invocation.attachment?.mode;
  if (
    workspace?.executionKind !== "local" ||
    ["automation", "schedule", "event"].includes(source ?? "") ||
    (mode !== undefined && mode !== "project")
  )
    throw new Error("Relay monitoring requires a local workspace in LOCAL mode");
};
export const request = async (ctx: CommandContext, path: string) => {
  ctx.signal.throwIfAborted();
  const release = await acquireQuery(ctx.signal);
  try {
    const response = await ctx.connections.request(connectionId, {
      method: "GET",
      path,
      timeoutMs: 10_000,
      signal: ctx.signal,
    });
    if (response.status !== 200 || JSON.stringify(response.body).length > 2 * 1024 ** 2)
      throw new Error("Monitoring query unavailable");
    return response.body;
  } catch {
    throw new Error("Monitoring query unavailable");
  } finally {
    release();
  }
};
export const checkConnection = async (ctx: CommandContext) => {
  await localOnly(ctx);
  const body = z
    .object({
      status: z.literal("ok"),
      environment: z.literal(environment),
      schemaVersion: z.literal(1),
      backends: z.object({ metrics: z.boolean(), logs: z.boolean(), alerts: z.boolean() }).optional(),
    })
    .parse(await request(ctx, "/health"));
  return { status: "connected" as const, queriedAt: Date.now() / 1000, backends: body.backends };
};
const label = (id: string, metric: Record<string, string>) => {
  if (id === "latency")
    return (
      ({ "0.5": "p50", "0.95": "p95", "0.99": "p99" } as Record<string, string>)[metric.quantile ?? ""] ?? "Latency"
    );
  const labels: Record<string, [string, RegExp]> = {
    errors: ["status", /^[45]\d\d$/],
    storage: ["kind", /^(updates|states|blobs)$/],
    resources: ["resource", /^(cpu|memory)$/],
    capacity: ["account", /^[a-z][a-z0-9-]{0,23}$/],
    ingestion: ["source", /^(relay|observer|prober|collector)$/],
  };
  if (id === "deployments")
    return /^(sha256-[a-f0-9]{64}|[a-f0-9]{7,40}|v\d+\.\d+\.\d+)$/.test(metric.release ?? "")
      ? metric.release!
      : "Unreported build";
  const definition = labels[id];
  if (!definition) return "Observed";
  const value = metric[definition[0]] ?? "";
  return definition[1].test(value) ? value : "Observed";
};
const pointsFor = (id: string, series: Series, start: number, end: number, step: number): Point[] =>
  series.flatMap((entry) => {
    const values = new Map(
      (entry.values ?? (entry.value ? [entry.value] : [])).map(([time, value]) => [Math.round(time), Number(value)]),
    );
    const times =
      id === "capacity"
        ? [end]
        : Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, index) => start + index * step);
    return times.map((time) => {
      const value = values.get(time);
      return {
        time,
        series: label(id, entry.metric),
        value: value !== undefined && Number.isFinite(value) ? value : null,
      };
    });
  });
export const readSnapshot = async (ctx: CommandContext, raw: unknown): Promise<Snapshot> => {
  const { range, section } = inputSchema.parse(raw);
  await localOnly(ctx);
  const end = Math.floor(Date.now() / 1000),
    step = Math.max(60, Math.ceil(windows[range] / 120)),
    start = end - Math.floor(windows[range] / step) * step;
  const snapshot: Snapshot = {
    range,
    section,
    queriedAt: end,
    start,
    end,
    connection: "unavailable",
    health: [],
    panels: [],
    checks: checks.map(([id, label]) => ({ id, label, state: "unknown", observedAt: null })),
  };
  let readiness: Awaited<ReturnType<typeof checkConnection>>;
  try {
    readiness = await checkConnection(ctx);
  } catch {
    snapshot.message =
      "Connect or check the read-only monitoring connection in Settings. No current observation is available.";
    return snapshot;
  }
  snapshot.connection = "connected";
  if (readiness.backends?.metrics === false) {
    snapshot.connection = "unavailable";
    snapshot.message = "Metrics query service is unavailable. No current observation is available.";
    return snapshot;
  }
  const degraded = Object.values(readiness.backends ?? {}).includes(false);
  if (degraded) snapshot.message = "A log or alert backend is unavailable. Available metrics are shown below.";
  const queries = expressions(step);
  const query = async (id: string, instant = false) => {
    const search = new URLSearchParams({
      query: queries[id]!,
      ...(instant ? { time: String(end) } : { start: String(start), end: String(end), step: String(step) }),
    });
    return resultSchema.parse(await request(ctx, `/prometheus/api/v1/${instant ? "query" : "query_range"}?${search}`))
      .data.result;
  };
  const selected = panelDefinitions.filter((panel) => visible[section].includes(panel.id));
  const jobs = ["health", "status", "observed", ...selected.map(({ id }) => id)];
  const results = new Map<string, Series>();
  // Exactly two requests per invocation in flight; cancellation propagates through the host connection.
  let next = 0;
  await Promise.all(
    [0, 1].map(async () => {
      while (next < jobs.length) {
        const id = jobs[next++]!;
        try {
          results.set(id, await query(id, ["status", "observed", "capacity"].includes(id)));
        } catch {
          ctx.signal.throwIfAborted();
        }
      }
    }),
  );
  snapshot.panels = selected.map(
    (panel): Panel => ({
      ...panel,
      points: pointsFor(panel.id, results.get(panel.id) ?? [], start, end, step),
      ...(!results.has(panel.id) ? { error: "Query unavailable" } : {}),
    }),
  );
  snapshot.checks = checks.map(([id, label]) => {
    const observed = Number(results.get("observed")?.find(({ metric }) => metric.check === id)?.value?.[1]);
    return {
      id,
      label,
      state:
        id === "monitoring" && degraded
          ? "critical"
          : stateFor(results.get("status")?.find(({ metric }) => metric.check === id)?.value?.[1]),
      observedAt: id === "monitoring" && degraded ? readiness.queriedAt : validObserved(observed, end),
    };
  });
  for (const [id, check] of Object.entries(lanes)) {
    const points = new Map(
      results
        .get("health")
        ?.find(({ metric }) => metric.check === id)
        ?.values?.map(([time, value]) => [
          time,
          (["ok", "unknown", "warning", "critical"] as const)[Number(value)] ?? "unknown",
        ]),
    );
    // The Prometheus range sample summarizes the bin ending at its timestamp.
    for (let time = start; time < end; time += step)
      snapshot.health.push({
        check,
        start: time,
        end: Math.min(time + step, end),
        state: {
          ok: "Healthy",
          warning: "Warning",
          critical: "Failing",
          unknown: "Unknown",
          "not-configured": "Unknown",
          unsupported: "Unknown",
        }[points.get(time + step) ?? "unknown"],
      });
  }
  return snapshot;
};

const validObserved = (observed: number, end: number) =>
  Number.isFinite(observed) && observed <= end ? observed : null;
