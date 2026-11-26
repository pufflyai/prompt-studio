import { forwardHttp } from "./preview-http";
import { type GateOptions, landing, type Preview, previewSessions, securityHeaders } from "./preview-session";
import { type Bridge, upstreamSocket } from "./preview-socket";

export function createPreviewGate(options: GateOptions) {
  const { local, config, port } = options;
  const external = config.origin;
  const hostname = new URL(external).host;
  const { isSignedIn, login } = previewSessions(options);
  async function authenticatedRequest(request: Request, listener: Bun.Server<Bridge>, url: URL) {
    const websocket = request.headers.get("upgrade")?.toLowerCase() === "websocket";
    const origin = request.headers.get("origin");
    const read = request.method === "GET" || request.method === "HEAD";
    if ((origin && origin !== external) || ((!read || websocket) && origin !== external))
      return new Response("Forbidden", { status: 403, headers: securityHeaders });
    const destination = new URL(local);
    destination.pathname = url.pathname;
    destination.search = url.search;
    if (destination.pathname.startsWith("/runtime/") && destination.pathname !== "/runtime/browser-session")
      return new Response("Not found", { status: 404, headers: securityHeaders });
    if (websocket) {
      const bridge = await upstreamSocket(destination, request, local);
      if (bridge && listener.upgrade(request, { data: bridge, headers: { "Sec-WebSocket-Protocol": "pstdio" } }))
        return;
      bridge?.upstream.close();
      return new Response("Dashboard connection unavailable", { status: 502, headers: securityHeaders });
    }
    return forwardHttp(destination, request, local);
  }
  const server = Bun.serve<Bridge>({
    hostname: "0.0.0.0",
    port,
    idleTimeout: 0,
    async fetch(request, listener) {
      const url = new URL(request.url);
      if (Date.now() >= config.expiresAt)
        return new Response("This preview expired", { status: 410, headers: securityHeaders });
      if (request.method === "GET" && url.pathname === "/__preview/health")
        return new Response("OK", { headers: { "X-PocketCoder-Workspace": config.workspaceId } });
      if (url.host !== hostname) return new Response("Not found", { status: 404, headers: securityHeaders });
      if (url.pathname === "/__preview/" && request.method === "GET") return landing();
      if (url.pathname === "/__preview/login") return login(request);
      if (!isSignedIn(request)) {
        if (request.method === "GET" && url.pathname === "/") return Response.redirect(external + "/__preview/");
        return new Response("A preview session is required", { status: 401, headers: securityHeaders });
      }
      return authenticatedRequest(request, listener, url);
    },
    websocket: {
      maxPayloadLength: 4 * 1024 * 1024,
      idleTimeout: 120,
      open(socket) {
        const bridge = socket.data;
        bridge.downstream = socket;
        if (bridge.upstream.readyState !== WebSocket.OPEN) return socket.close(1001, "Dashboard disconnected");
        for (const data of bridge.pending) socket.send(data);
        bridge.pending = [];
      },
      message(socket, data) {
        const upstream = socket.data.upstream;
        if (upstream.readyState !== WebSocket.OPEN || upstream.bufferedAmount > 4 * 1024 * 1024)
          return socket.close(1013, "Dashboard connection unavailable");
        upstream.send(data);
      },
      close(socket) {
        socket.data.upstream.close();
      },
    },
  });

  setTimeout(() => void server.stop(true), Math.max(0, config.expiresAt - Date.now())).unref();
  return server;
}
if (import.meta.main)
  createPreviewGate({
    home: "/workspace/preview-home",
    root: "/workspace/pstdio-https",
    local: "http://127.0.0.1:3030",
    port: 8080,
    config: (await Bun.file("/workspace/pstdio-https/preview.json").json()) as Preview,
  });
