import type { createMetricRegistry } from "pstdio-service-telemetry";

/** One bounded OTLP batch. Failures retain the previous timestamps; they never hold the service open. */
export const exportMetrics = async (
  registry: ReturnType<typeof createMetricRegistry>,
  endpoint: string | undefined,
  signal: AbortSignal,
) => {
  if (!endpoint) return;
  const timeUnixNano = String(BigInt(Date.now()) * 1_000_000n);
  const metrics = registry.snapshot().map(({ name, value, labels }) => ({
    name,
    gauge: {
      dataPoints: [
        {
          timeUnixNano,
          asDouble: value,
          attributes: Object.entries(labels).map(([key, value]) => ({ key, value: { stringValue: value } })),
        },
      ],
    },
  }));
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resourceMetrics: [{ scopeMetrics: [{ metrics }] }] }),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error("Metric delivery failed");
};
