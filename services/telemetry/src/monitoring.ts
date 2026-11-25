import { type ServiceFailure, serviceFailures } from "./failures";
import { createMetricRegistry } from "./metric-registry";

// Class and code only: messages can carry identifiers or payload details. Includes one wrapped cause,
// because database clients wrap the PostgreSQL error that names the failure.
const errorCause = (error: unknown): string | undefined => {
  const describe = (value: unknown) => {
    if (!(value instanceof Error)) return undefined;
    const { code, $metadata } = value as { code?: unknown; $metadata?: { httpStatusCode?: unknown } };
    const status = $metadata?.httpStatusCode;
    const parts = [value.name, typeof code === "string" || typeof code === "number" ? String(code) : undefined];
    if (typeof status === "number") parts.push(String(status));
    return parts.filter((part) => part && /^[A-Za-z0-9_.-]{1,48}$/.test(part)).join(":") || undefined;
  };
  const outer = describe(error);
  const inner = error instanceof Error ? describe(error.cause) : undefined;
  return outer && inner ? `${outer}<-${inner}` : (outer ?? inner);
};

const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, Infinity];
const operation = (request: Request) => {
  const path = new URL(request.url).pathname;
  if (path === "/health") return "health";
  if (path === "/v1/environment-access") return "access.renew";
  if (/\/documents\/[^/]+\/read$/.test(path)) return "document.read";
  if (/\/documents\/[^/]+\/updates$/.test(path)) return "document.update";
  if (/\/documents\/[^/]+\/state$/.test(path)) return "document.state";
  if (/\/blobs\/[^/]+\/parts\/\d+$/.test(path)) return "blob.part";
  if (/\/blobs\/[^/]+\/(begin|begin-manifest|finish|read)$/.test(path)) return "blob.operation";
  if (path.endsWith("/live")) return "live.connect";
  return "other";
};

/** Optional diagnostics listener and allowlisted OTLP logs; neither owns application availability. */
export const createServiceMonitoring = (env: Record<string, string | undefined>, service: "relay" | "manager") => {
  const configured = env.METRICS_PORT !== undefined || Boolean(env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT);
  const environment = env.MONITORING_ENVIRONMENT ?? "development";
  if (configured && !["production", "development", "test"].includes(environment))
    throw new Error("Invalid monitoring environment");
  const port = env.METRICS_PORT === undefined ? undefined : Number(env.METRICS_PORT);
  if (port !== undefined && (env.METRICS_PORT === "" || !Number.isInteger(port) || port < 0 || port > 65535))
    throw new Error("Invalid metrics port");
  const registry = createMetricRegistry(`pstdio_${service}`, { environment, service });
  registry.declare("http_requests_total", "counter");
  registry.declare("http_request_duration_seconds", "histogram");
  for (const failure of Object.keys(serviceFailures)) registry.add("operation_failures_total", 0, { failure });
  const started = Date.now() / 1000;
  const pending = new Set<AbortController>();
  let closed = false;
  let sample = () => {};
  const logEndpoint = env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  if (logEndpoint && !["http:", "https:"].includes(new URL(logEndpoint).protocol))
    throw new Error("Invalid log endpoint");
  const release = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(env.TELEMETRY_RELEASE ?? "")
    ? env.TELEMETRY_RELEASE!
    : "unknown";
  registry.set("build_info", 1, { release });
  const render = () => {
    registry.set("uptime_seconds", Date.now() / 1000 - started);
    registry.set("process_resident_memory_bytes", process.memoryUsage.rss());
    registry.set("observation_timestamp_seconds", Date.now() / 1000);
    try {
      sample();
    } catch {
      registry.add("collection_failures_total");
    }
    return registry.render();
  };
  const server =
    port === undefined
      ? undefined
      : Bun.serve({
          hostname: env.METRICS_HOST ?? "127.0.0.1",
          port,
          fetch(request) {
            if (request.method !== "GET" || new URL(request.url).pathname !== "/metrics")
              return new Response(null, { status: 404 });
            return new Response(render(), {
              headers: { "content-type": "text/plain; version=0.0.4", "cache-control": "no-store" },
            });
          },
        });
  const failure = (code: ServiceFailure, error?: unknown) => {
    if (!Object.hasOwn(serviceFailures, code) || closed) return;
    registry.add("operation_failures_total", 1, { failure: code });
    if (!logEndpoint) return;
    if (pending.size >= 8) {
      registry.add("telemetry_dropped_total");
      return;
    }
    const controller = new AbortController();
    pending.add(controller);
    const timer = setTimeout(() => controller.abort(), 2000);
    timer.unref();
    const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });
    const cause = errorCause(error);
    void fetch(logEndpoint, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceLogs: [
          {
            resource: {
              attributes: [
                attribute("service.name", service),
                attribute("deployment.environment.name", environment),
                attribute("service.version", release),
                attribute("loki.resource.labels", "service.name"),
              ],
            },
            scopeLogs: [
              {
                logRecords: [
                  {
                    timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
                    severityText: "ERROR",
                    body: { stringValue: code },
                    attributes: [attribute("failure", code), ...(cause ? [attribute("cause", cause)] : [])],
                  },
                ],
              },
            ],
          },
        ],
      }),
    })
      .then(async (response) => {
        await response.body?.cancel();
        registry.add(response.ok ? "telemetry_sent_total" : "telemetry_failed_total");
      })
      .catch(() => {
        registry.add("telemetry_failed_total");
      })
      .finally(() => {
        clearTimeout(timer);
        pending.delete(controller);
      });
  };
  return {
    url: server?.url ?? null,
    render,
    failure,
    gauge: registry.set,
    sample(collect: () => void) {
      sample = collect;
    },
    wrap<T extends Response | undefined>(handler: (request: Request) => T | Promise<T>) {
      return async (request: Request) => {
        const begin = performance.now();
        const finish = (status: number) => {
          if (!configured) return;
          const seconds = (performance.now() - begin) / 1000;
          const op = operation(request);
          const labels = { operation: op, status_class: `${Math.floor(status / 100)}xx` };
          registry.add("http_requests_total", 1, { operation: op, status: String(status) });
          registry.add("http_request_duration_seconds_sum", seconds, labels);
          registry.add("http_request_duration_seconds_count", 1, labels);
          for (const bound of buckets)
            registry.add("http_request_duration_seconds_bucket", seconds <= bound ? 1 : 0, {
              ...labels,
              le: bound === Infinity ? "+Inf" : String(bound),
            });
        };
        try {
          const response = await handler(request);
          finish(response?.status ?? 101);
          return response;
        } catch (error) {
          finish(request.signal.aborted ? 499 : 500);
          throw error;
        }
      };
    },
    async cleanup<T>(run: () => Promise<T>) {
      const begin = performance.now();
      try {
        const result = await run();
        registry.set("cleanup_last_success_timestamp_seconds", Date.now() / 1000);
        registry.add("cleanup_runs_total", 1, { outcome: "success" });
        return result;
      } catch (error) {
        registry.add("cleanup_runs_total", 1, { outcome: "failed" });
        throw error;
      } finally {
        registry.set("cleanup_duration_seconds", (performance.now() - begin) / 1000);
      }
    },
    async close() {
      closed = true;
      for (const controller of pending) controller.abort();
      await server?.stop(true);
    },
  };
};
export type ServiceMonitoring = ReturnType<typeof createServiceMonitoring>;
