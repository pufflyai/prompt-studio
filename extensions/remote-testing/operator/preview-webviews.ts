export {};

const upstream = "http://127.0.0.1:3030";
const config = (await Bun.file("/workspace/pstdio-https/preview.json").json()) as { expiresAt: number; origin: string };
const host = new URL(config.origin).host;
const assetPath = /^\/v1\/extensions\/webviews\/[A-Za-z0-9_-]{43}\/[^/]+\/[^/]+\/(?:runtime|(?:assets|artifacts)\/.+)$/;
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: 8081,
  async fetch(request) {
    if (Date.now() >= config.expiresAt) return new Response("Preview expired", { status: 410, headers });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/__preview/health") return new Response("OK");
    if (url.host !== host || !assetPath.test(url.pathname)) {
      return new Response("Not found", { status: 404, headers });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    }
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== "null") {
      return new Response("Forbidden", { status: 403, headers });
    }

    const destination = new URL(upstream);
    destination.pathname = url.pathname;
    destination.search = url.search;
    try {
      // Prompt Studio authorizes the signed URL. The sandbox cannot use a dashboard cookie.
      const response = await fetch(destination, {
        method: request.method,
        headers: origin === "null" ? { Origin: "null" } : undefined,
        redirect: "error",
        signal: request.signal,
      });
      const outgoing = new Headers(headers);
      for (const name of [
        "content-type",
        "access-control-allow-origin",
        "vary",
        "content-security-policy",
        "cross-origin-resource-policy",
        "x-frame-options",
      ]) {
        const value = response.headers.get(name);
        if (value) outgoing.set(name, value);
      }
      return new Response(response.body, { status: response.status, headers: outgoing });
    } catch {
      return new Response("Extension asset temporarily unavailable", { status: 503, headers });
    }
  },
});

setTimeout(() => void server.stop(true), Math.max(0, config.expiresAt - Date.now()));
