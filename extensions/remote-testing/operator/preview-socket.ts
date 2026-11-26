export type Bridge = {
  upstream: WebSocket;
  pending: (string | ArrayBuffer)[];
  bytes: number;
  downstream?: Bun.ServerWebSocket<Bridge>;
};
const forwardHeaders = [
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "if-none-match",
  "if-modified-since",
  "range",
];

export async function upstreamSocket(url: URL, request: Request, local: string) {
  const protocol = request.headers
    .get("sec-websocket-protocol")
    ?.split(",")
    .map((entry) => entry.trim());
  if (protocol?.[0] !== "pstdio" || !protocol[1]?.startsWith("pstdio.bearer.")) return null;
  const wsUrl = new URL(url);
  wsUrl.protocol = "ws:";
  const upstream = new WebSocket(wsUrl, { protocols: protocol, headers: { Origin: local } });
  upstream.binaryType = "arraybuffer";
  const bridge: Bridge = { upstream, pending: [], bytes: 0 };
  upstream.addEventListener("message", ({ data }: MessageEvent<string | ArrayBuffer>) => {
    if (bridge.downstream) {
      if (bridge.downstream.send(data) === -1) bridge.downstream.close(1013, "Connection overloaded");
      return;
    }
    bridge.bytes += typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
    if (bridge.bytes > 1024 * 1024) return upstream.close(1009, "Connection overloaded");
    bridge.pending.push(data);
  });
  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      upstream.close();
      resolve(false);
    }, 3000);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      resolve(ok);
    };
    upstream.addEventListener("open", () => finish(true), { once: true });
    upstream.addEventListener("error", () => finish(false), { once: true });
    upstream.addEventListener("close", () => finish(false), { once: true });
  });
  if (!ready || upstream.protocol !== "pstdio") {
    upstream.close();
    return null;
  }
  upstream.addEventListener("close", () => bridge.downstream?.close(1001, "Dashboard disconnected"));
  upstream.addEventListener("error", () => bridge.downstream?.close(1011, "Dashboard connection failed"));
  return bridge;
}
