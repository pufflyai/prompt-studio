import { expect, test } from "bun:test";
import { createServiceMonitoring } from "./monitoring";

test("latency histograms include zero buckets below the first observation", async () => {
  const monitoring = createServiceMonitoring({ METRICS_PORT: "0", MONITORING_ENVIRONMENT: "test" }, "relay");
  try {
    await monitoring.wrap(async () => {
      await Bun.sleep(12);
      return new Response(null);
    })(new Request("http://owned.test/health"));
    expect(monitoring.render()).toContain(
      'http_request_duration_seconds_bucket{environment="test",le="0.005",operation="health",service="relay",status_class="2xx"} 0',
    );
  } finally {
    await monitoring.close();
  }
});

import type { ServiceFailure } from "./telemetry";

test("private metrics describe operations without recording request identities", async () => {
  const monitoring = createServiceMonitoring({ METRICS_PORT: "0", MONITORING_ENVIRONMENT: "test" }, "relay");
  try {
    const handle = monitoring.wrap(async () => new Response(null, { status: 503 }));
    await handle(new Request("https://relay.example/sync/projects/~private-account/documents/~secret-document/read"));
    monitoring.failure("sync_document_failed");
    const response = await fetch(new URL("/metrics", monitoring.url!));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('operation="document.read"');
    expect(body).toContain('status="503"');
    expect(body).toContain("pstdio_relay_http_request_duration_seconds_bucket");
    expect(body).toContain('failure="sync_document_failed"');
    for (const secret of ["private-account", "secret-document", "relay.example"]) expect(body).not.toContain(secret);
    expect((await fetch(new URL("/unlisted", monitoring.url!))).status).toBe(404);
    expect((await fetch(new URL("/metrics", monitoring.url!), { method: "POST" })).status).toBe(404);
  } finally {
    await monitoring.close();
  }
});

test("cleanup success, failure and last observation remain distinct", async () => {
  const monitoring = createServiceMonitoring({ METRICS_PORT: "0", MONITORING_ENVIRONMENT: "test" }, "relay");
  try {
    await monitoring.cleanup(async () => {});
    const before = monitoring.render();
    expect(before).toContain("pstdio_relay_cleanup_last_success_timestamp_seconds");
    await expect(
      monitoring.cleanup(async () => {
        throw new Error("private database URL");
      }),
    ).rejects.toThrow();
    const after = monitoring.render();
    expect(after).toContain('outcome="failed"');
    expect(after).not.toContain("private database URL");
    const last = (text: string) =>
      text.split("\n").find((line) => line.startsWith("pstdio_relay_cleanup_last_success"));
    expect(last(after)).toBe(last(before));
  } finally {
    await monitoring.close();
  }
});

test("unavailable log delivery is bounded, redacted and independent of requests", async () => {
  const captures: unknown[] = [];
  const captured = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const receiver = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      captures.push(await request.json());
      captured.resolve();
      await release.promise;
      return new Response(null, { status: 503 });
    },
  });
  const monitoring = createServiceMonitoring(
    {
      METRICS_PORT: "0",
      MONITORING_ENVIRONMENT: "test",
      TELEMETRY_RELEASE: "test-release",
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: new URL("/v1/logs", receiver.url).href,
    },
    "relay",
  );
  try {
    for (let i = 0; i < 20; i++) monitoring.failure("asset_operation_failed");
    monitoring.failure("secret-token" as ServiceFailure);
    const response = await monitoring.wrap(async () => new Response("usable"))(new Request("http://owned.test/health"));
    expect(await response?.text()).toBe("usable");
    expect(monitoring.render()).toContain("pstdio_relay_telemetry_dropped_total");
    await captured.promise;
    expect(captures.length).toBeGreaterThan(0);
    expect(captures.length).toBeLessThanOrEqual(8);
    const content = JSON.stringify(captures);
    expect(content).toContain("asset_operation_failed");
    expect(content).not.toContain("secret-token");
  } finally {
    release.resolve();
    await monitoring.close();
    await receiver.stop(true);
  }
});

test("failure logs name the error class and code without its message", async () => {
  const captured = Promise.withResolvers<unknown>();
  const receiver = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      captured.resolve(await request.json());
      return new Response(null, { status: 200 });
    },
  });
  const monitoring = createServiceMonitoring(
    { MONITORING_ENVIRONMENT: "test", OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: new URL("/v1/logs", receiver.url).href },
    "relay",
  );
  try {
    const database = Object.assign(new Error("relation for project-secret failed"), {
      name: "DatabaseError",
      code: "40001",
    });
    monitoring.failure("sync_document_failed", new Error("Failed query: select project-secret", { cause: database }));
    const content = JSON.stringify(await captured.promise);
    expect(content).toContain('"key":"cause","value":{"stringValue":"Error<-DatabaseError:40001"}');
    expect(content).not.toContain("project-secret");
  } finally {
    await monitoring.close();
    await receiver.stop(true);
  }
});

test("monitoring opens no listener by default and rejects invalid explicit configuration", async () => {
  const monitoring = createServiceMonitoring({}, "relay");
  expect(monitoring.url).toBeNull();
  await monitoring.close();
  expect(() => createServiceMonitoring({ METRICS_PORT: "invalid", MONITORING_ENVIRONMENT: "test" }, "relay")).toThrow();
});
