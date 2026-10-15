interface RelayConfig {
  hostname: string;
  port: number;
}

export function readConfig(env: Record<string, string | undefined>) {
  const port = Number(env.RELAY_PORT ?? "8080");
  if (env.RELAY_PORT === "" || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("RELAY_PORT must be an integer between 0 and 65535");
  }
  return { hostname: env.RELAY_HOST ?? "127.0.0.1", port };
}

export function startRelay(config: RelayConfig) {
  return Bun.serve({
    ...config,
    fetch(request) {
      if (request.method === "GET" && new URL(request.url).pathname === "/health") {
        return Response.json({ status: "ok" });
      }
      return new Response("Not found", { status: 404 });
    },
  });
}
