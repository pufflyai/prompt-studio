import { expect, test } from "bun:test";
import { createMonitoringGateway } from "./gateway";

test("readiness reports an unavailable logging backend independently of a reachable gateway", async () => {
  const backend = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => new Response(null, { status: new URL(request.url).pathname === "/ready" ? 503 : 200 }),
  });
  const gateway = createMonitoringGateway({
    environment: "test",
    readToken: "reader",
    metricsToken: "writer",
    logsToken: "logger",
    metricsOrigin: backend.url.href,
    logsOrigin: backend.url.href,
    alertsOrigin: backend.url.href,
  });
  try {
    const response = await gateway(
      new Request("http://owned-gateway.test/health", { headers: { authorization: "Bearer reader" } }),
    );
    expect((await response.json()).backends).toEqual({ metrics: true, logs: false, alerts: true });
  } finally {
    await backend.stop(true);
  }
});

test("query, metric-write and log-write credentials grant separate capabilities", async () => {
  const seen: { path: string; authorization: string | null }[] = [];
  const backend = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      seen.push({ path: new URL(request.url).pathname, authorization: request.headers.get("authorization") });
      return request.method === "POST"
        ? new Response(null, { status: 204 })
        : Response.json({ status: "success", data: { result: [] } });
    },
  });
  const gateway = createMonitoringGateway({
    environment: "production",
    readToken: "reader-secret",
    metricsToken: "metrics-secret",
    logsToken: "logs-secret",
    metricsOrigin: backend.url.href,
    logsOrigin: backend.url.href,
    alertsOrigin: backend.url.href,
  });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: gateway });
  const call = (path: string, token: string, method = "GET") =>
    fetch(new URL(path, server.url), {
      method,
      headers: { authorization: `Bearer ${token}` },
      ...(method === "POST" ? { body: "owned bytes" } : {}),
    });
  try {
    expect((await call("/prometheus/api/v1/query?query=up", "reader-secret")).status).toBe(200);
    expect((await call("/write/metrics", "reader-secret", "POST")).status).toBe(403);
    expect((await call("/write/logs", "metrics-secret", "POST")).status).toBe(403);
    expect((await call("/write/metrics", "metrics-secret", "POST")).status).toBe(204);
    expect((await call("/write/logs", "logs-secret", "POST")).status).toBe(204);
    expect((await call("/prometheus/api/v1/admin/tsdb/delete_series", "reader-secret", "POST")).status).toBe(404);
    expect((await call("/alerts/api/v2/silences", "reader-secret", "POST")).status).toBe(404);
    expect((await call("/health", "wrong-secret")).status).toBe(401);
    expect(seen.map((value) => value.path)).toEqual(["/api/v1/query", "/api/v1/write", "/loki/api/v1/push"]);
    expect(seen.every((value) => value.authorization === null)).toBe(true);
    expect((await (await call("/health", "reader-secret")).json()).environment).toBe("production");
  } finally {
    await server.stop(true);
    await backend.stop(true);
  }
});

test("redirects and oversized backend bodies produce bounded fixed failures", async () => {
  const backend = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      return new URL(request.url).searchParams.get("query") === "redirect"
        ? new Response(null, { status: 302, headers: { location: "https://private-credential.example/" } })
        : new Response(new Uint8Array(2 * 1024 ** 2 + 1));
    },
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: createMonitoringGateway({
      environment: "test",
      readToken: "reader",
      metricsToken: "writer",
      logsToken: "logger",
      metricsOrigin: backend.url.href,
      logsOrigin: backend.url.href,
      alertsOrigin: backend.url.href,
    }),
  });
  try {
    for (const query of ["redirect", "large"]) {
      const response = await fetch(new URL(`/prometheus/api/v1/query?query=${query}`, server.url), {
        headers: { authorization: "Bearer reader" },
      });
      expect(response.status).toBe(502);
      const body = await response.text();
      expect(body).not.toContain("private-credential.example");
      expect(body.length).toBeLessThan(200);
    }
  } finally {
    await server.stop(true);
    await backend.stop(true);
  }
});
