import type { ServerWebSocket } from "bun";

/** Server-side behavior of one upgraded WebSocket. */
export interface RelaySocket {
  open(socket: Pick<ServerWebSocket, "send" | "close">): void;
  message(data: string | Buffer): void;
  close(code?: number): void;
}
