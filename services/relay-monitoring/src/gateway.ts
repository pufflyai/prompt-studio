import { createHash, timingSafeEqual } from "node:crypto";
import { readBounded } from "./io";

export interface GatewayConfig {
  environment: string;
  readToken: string;
  metricsToken: string;
  logsToken: string;
  metricsOrigin: string;
  logsOrigin: string;
  alertsOrigin: string;
}
const hash = (value: string) => createHash("sha256").update(value).digest();
const json = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
const routes = {
  "GET /prometheus/api/v1/query": { role: "reader", backend: "metricsOrigin", path: "/api/v1/query" },
  "GET /prometheus/api/v1/query_range": { role: "reader", backend: "metricsOrigin", path: "/api/v1/query_range" },
  "GET /loki/api/v1/query_range": { role: "reader", backend: "logsOrigin", path: "/loki/api/v1/query_range" },
  "GET /alerts/api/v2/alerts": { role: "reader", backend: "alertsOrigin", path: "/api/v2/alerts" },
  "POST /write/metrics": { role: "metrics", backend: "metricsOrigin", path: "/api/v1/write" },
  "POST /write/logs": { role: "logs", backend: "logsOrigin", path: "/loki/api/v1/push" },
} as const;

export const createMonitoringGateway = (config: GatewayConfig) => {
  if (new Set([config.readToken, config.metricsToken, config.logsToken]).size !== 3)
    throw new Error("Monitoring credentials must be distinct");
  const tokens = { reader: hash(config.readToken), metrics: hash(config.metricsToken), logs: hash(config.logsToken) };
  let active = 0;
  return async (request: Request) => {
    const url = new URL(request.url);
    const health = healthRequest(request, url);
    const route = routes[`${request.method} ${url.pathname}` as keyof typeof routes];
    if (!health && !route) return json("not-found", 404);
    const denied = authorize(request, tokens, health ? "reader" : route!.role);
    if (denied) return denied;
    if (health) return readiness(config, request.signal);
    if (active >= 8) return json("monitoring-busy", 429);
    if (url.search.length > 8192) return json("query-limit-exceeded", 400);
    const target = new URL(route!.path, config[route!.backend]);
    try {
      constrainQuery(url, target, request.method);
    } catch {
      return json("query-limit-exceeded", 400);
    }
    active++;
    try {
      return await forward(request, target, config.environment);
    } catch {
      return json("monitoring-backend-unavailable", 502);
    } finally {
      active--;
      await cancelBody(request);
    }
  };
};
const cancelBody = async (request: Request) => {
  if (request.body && !request.body.locked) await request.body.cancel().catch(() => {});
};
const healthRequest = (request: Request, url: URL) =>
  request.method === "GET" && url.pathname === "/health" && !url.search;
const readiness = async (config: GatewayConfig, signal: AbortSignal) => {
  const checks = await Promise.all(
    (
      [
        ["metrics", config.metricsOrigin, "/-/ready"],
        ["logs", config.logsOrigin, "/ready"],
        ["alerts", config.alertsOrigin, "/-/ready"],
      ] as const
    ).map(async ([name, origin, path]) => {
      try {
        const response = await fetch(new URL(path, origin), {
          signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
          redirect: "error",
        });
        await response.body?.cancel();
        return [name, response.ok] as const;
      } catch {
        return [name, false] as const;
      }
    }),
  );
  return Response.json(
    {
      status: "ok",
      environment: config.environment,
      schemaVersion: 1,
      observedAt: Date.now() / 1000,
      backends: Object.fromEntries(checks),
    },
    { headers: { "cache-control": "no-store" } },
  );
};

const constrainQuery = (url: URL, target: URL, method: string) => {
  if (method === "GET") {
    target.search = url.search;
    if (url.pathname.startsWith("/prometheus/")) {
      target.searchParams.set("timeout", "10s");
      target.searchParams.set("limit", "50");
    }
    if (url.pathname.startsWith("/loki/")) target.searchParams.set("limit", "200");
    const start = target.searchParams.get("start");
    const end = target.searchParams.get("end");
    if (start && end && !url.pathname.startsWith("/loki/")) {
      const seconds = (value: string) => (Number.isFinite(Number(value)) ? Number(value) : Date.parse(value) / 1000);
      if (
        !Number.isFinite(seconds(start) + seconds(end)) ||
        seconds(end) < seconds(start) ||
        seconds(end) - seconds(start) > 30 * 86400
      )
        throw new Error("Query limit exceeded");
    }
  }
};

const forward = async (request: Request, target: URL, environment: string) => {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
  const headers = new Headers();
  for (const name of ["content-type", "content-encoding", "x-prometheus-remote-write-version"])
    if (request.headers.has(name)) headers.set(name, request.headers.get(name)!);
  const response = await fetch(target, {
    method: request.method,
    redirect: "error",
    signal,
    headers,
    ...(request.method === "POST"
      ? { body: (await readBounded(request.body, undefined, signal)) as Uint8Array<ArrayBuffer> }
      : {}),
  });
  const bytes = await readBounded(response.body, undefined, signal);
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "x-monitoring-environment": environment,
      "cache-control": "no-store",
    },
  });
};

const roleFor = (request: Request, tokens: Record<string, ReturnType<typeof hash>>) => {
  const credential = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const supplied = hash(credential);
  return Object.entries(tokens).find(([, token]) => timingSafeEqual(supplied, token))?.[0];
};

const authorize = (request: Request, tokens: Record<string, ReturnType<typeof hash>>, required: string) => {
  const role = roleFor(request, tokens);
  if (!role) return json("monitoring-access-denied", 401);
  return role === required ? null : json("monitoring-capability-denied", 403);
};
