import { connectRelay, inspectRelayAccount } from "pstdio-relay";
import { createMetricRegistry } from "pstdio-service-telemetry";
import { z } from "zod";
import { addressSchema, environmentSchema, readBounded } from "./io";

const alias = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const observerConfigSchema = z
  .object({
    environment: environmentSchema,
    databaseUrl: z.string().min(1),
    gracePeriodMs: z.number().int().nonnegative(),
    accounts: z
      .array(z.object({ alias, accountId: z.string().min(1), quotaBytes: z.number().positive() }))
      .min(1)
      .max(20),
    otlpEndpoint: addressSchema.optional(),
    provider: z
      .object({
        token: z.string().min(1),
        appId: z.uuid(),
        component: z.string().min(1),
        expectedInstances: z.number().int().positive(),
      })
      .optional(),
    backup: z.object({ lastSuccessAt: z.iso.datetime(), lastRestoreAt: z.iso.datetime() }).optional(),
  })
  .strict()
  .refine(
    (value) => new Set(value.accounts.map((account) => account.alias)).size === value.accounts.length,
    "Aliases must be unique",
  );
export type ObserverConfig = z.infer<typeof observerConfigSchema>;

export const createObserver = (config: ObserverConfig) => {
  const connection = connectRelay(config.databaseUrl);
  const metrics = createMetricRegistry("pstdio_relay", { environment: config.environment });
  const collect = async (signal: AbortSignal) => {
    metrics.set("backup_configured", config.backup ? 1 : 0);
    metrics.set("provider_configured", config.provider ? 1 : 0);
    const begin = performance.now();
    let successful = true;
    for (const account of config.accounts) {
      const labels = { account: account.alias };
      metrics.set("account_quota_bytes", account.quotaBytes, labels);
      try {
        const report = await connection.run(
          (db) =>
            inspectRelayAccount(db, {
              accountId: account.accountId,
              gracePeriodMs: config.gracePeriodMs,
              largestDocuments: 0,
              statementTimeoutMs: 10_000,
            }),
          signal,
        );
        metrics.set("account_storage_bytes", report.bytes, labels);
        for (const kind of ["updates", "states", "blobs"] as const) {
          const value = report.projects.reduce(
            (sum, project) =>
              sum +
              (kind === "blobs"
                ? Object.values(project.blobs).reduce((bytes, item) => bytes + item.bytes, 0)
                : project[kind].bytes),
            0,
          );
          metrics.set("storage_bytes", value, { ...labels, kind });
        }
        metrics.set(
          "cleanup_eligible_bytes",
          report.projects.reduce(
            (sum, project) =>
              sum +
              project.updates.covered.eligibleBytes +
              project.states.replaced.eligibleBytes +
              project.orphanedBlobs.eligibleBytes,
            0,
          ),
          labels,
        );
        metrics.set(
          "blobs_deleting",
          report.projects.reduce((sum, project) => sum + project.blobs.deleting.count, 0),
          labels,
        );
        metrics.set("account_observed_timestamp_seconds", Date.parse(report.generatedAt) / 1000, labels);
        metrics.set("account_observation_success", 1, labels);
      } catch {
        successful = false;
        metrics.set("account_observation_success", 0, labels);
      }
    }
    metrics.set("database_query_success", successful ? 1 : 0);
    metrics.set("database_query_duration_seconds", (performance.now() - begin) / 1000);
    metrics.set("database_observed_timestamp_seconds", Date.now() / 1000);
    await collectProvider(config, metrics, signal);
    collectBackup(config, metrics);
    metrics.set("observer_heartbeat_timestamp_seconds", Date.now() / 1000);
  };
  return { metrics, collect, close: connection.close };
};

const collectProvider = async (
  config: ObserverConfig,
  metrics: ReturnType<typeof createMetricRegistry>,
  signal: AbortSignal,
) => {
  const provider = config.provider;
  if (!provider) return;
  try {
    const values = await Promise.all(
      (["cpu", "memory"] as const).map((kind) => readProviderMetric(provider, kind, signal)),
    );
    // Publish one complete snapshot. A memory response must never freshen an old CPU observation.
    for (const value of values) metrics.set("resource_percent", value.percent, { resource: value.kind });
    metrics.set("provider_observed_timestamp_seconds", Math.min(...values.map((value) => value.observedAt)));
    metrics.set("instances_observed", Math.min(...values.map((value) => value.instances)));
    metrics.set("instances_expected", provider.expectedInstances);
    metrics.set("provider_collection_success", 1);
  } catch {
    metrics.set("provider_collection_success", 0);
    metrics.add("provider_collection_failures_total");
  }
};
const readProviderMetric = async (
  provider: NonNullable<ObserverConfig["provider"]>,
  kind: "cpu" | "memory",
  signal: AbortSignal,
) => {
  const url = new URL(`https://api.digitalocean.com/v2/monitoring/metrics/apps/${kind}_percentage`);
  const end = Math.floor(Date.now() / 1000);
  url.search = new URLSearchParams({
    app_id: provider.appId,
    app_component: provider.component,
    start: String(end - 180),
    end: String(end),
  }).toString();
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${provider.token}` },
    signal,
    redirect: "error",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Provider unavailable");
  }
  const body = z
    .object({
      data: z.object({ result: z.array(z.object({ values: z.array(z.tuple([z.number(), z.string()])) })).max(50) }),
    })
    .parse(JSON.parse(new TextDecoder().decode(await readBounded(response.body, undefined, signal))));
  const latest = body.data.result
    .map((series) => series.values.at(-1))
    .filter(
      (value): value is [number, string] =>
        value !== undefined && Number.isFinite(Number(value[1])) && value[0] <= end && value[0] >= end - 180,
    );
  if (!latest.length) throw new Error("No provider observation");
  return {
    kind,
    percent: Math.max(...latest.map((value) => Number(value[1]))),
    observedAt: Math.min(...latest.map((value) => value[0])),
    instances: latest.length,
  };
};

const collectBackup = (config: ObserverConfig, metrics: ReturnType<typeof createMetricRegistry>) => {
  if (config.backup) {
    for (const [name, value] of [
      ["backup", config.backup.lastSuccessAt],
      ["restore", config.backup.lastRestoreAt],
    ] as const) {
      const timestamp = Date.parse(value) / 1000;
      if (timestamp <= Date.now() / 1000) metrics.set(`${name}_evidence_timestamp_seconds`, timestamp);
    }
  }
};
