import type { ServerWebSocket } from "bun";
import { type LiveServerMessage, liveClientMessageSchema, syncProtocolVersion } from "pstdio-sync-contracts/protocol";
import type { RelayLimits } from "../limits";
import type { DocumentChange } from "../storage/documents";
import type { RateLimit } from "./rate-limit";

type Socket = Pick<ServerWebSocket, "send" | "close">;

export interface LiveIdentity {
  projectKey: string;
  accountId: string;
  deviceId: string;
  expiresAt: string;
}

interface LiveConnection extends LiveIdentity {
  send(message: LiveServerMessage): void;
}

// Personal-space traffic reaches only the owner's devices (R26).
const canRead = (connection: LiveIdentity, spaceOwner: string | null) =>
  spaceOwner === null || spaceOwner === connection.accountId;

/** Returns the message, or the WebSocket close code that refuses it. */
const parseLiveMessage = (data: string | Buffer, identity: LiveIdentity, limits: RelayLimits) => {
  if (typeof data !== "string" || data.length > limits.maxLiveMessageBytes * 2) return 1009;
  let input: unknown;
  try {
    input = JSON.parse(data);
  } catch {
    return 1008;
  }
  const parsed = liveClientMessageSchema.safeParse(input);
  if (!parsed.success || !canRead(identity, parsed.data.spaceOwner)) return 1008;
  if (Buffer.byteLength(parsed.data.payload, "base64") > limits.maxLiveMessageBytes) return 1009;
  return { spaceOwner: parsed.data.spaceOwner, payload: parsed.data.payload };
};

/**
 * Forwards live messages and change notices between the devices connected to this relay process.
 * Nothing passes through storage (R31).
 */
export const createLiveHub = (limits: RelayLimits, allow: RateLimit) => {
  const projects = new Map<string, Set<LiveConnection>>();
  const deliver = (
    projectKey: string,
    message: LiveServerMessage & { spaceOwner: string | null },
    from?: LiveConnection,
  ) => {
    for (const connection of projects.get(projectKey) ?? [])
      if (connection !== from && canRead(connection, message.spaceOwner)) connection.send(message);
  };
  return {
    changed({ projectKey, spaceOwner, documentId, lastSequence, stateId }: DocumentChange) {
      deliver(projectKey, { type: "changed", spaceOwner, documentId, lastSequence, stateId });
    },
    connect(identity: LiveIdentity) {
      let socket: Socket | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      const close = (code = 1000) => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        const members = projects.get(identity.projectKey);
        members?.delete(connection);
        if (members?.size === 0) projects.delete(identity.projectKey);
        socket?.close(code, code === 1008 ? "Live message refused" : "Live connection ended");
      };
      const connection: LiveConnection = {
        ...identity,
        send(message) {
          // No queue: a consumer that cannot keep up reconnects and reads documents again.
          if (!stopped && socket && socket.send(JSON.stringify(message)) <= 0) close(1013);
        },
      };
      const expiry = new Date(identity.expiresAt).getTime();
      const scheduleExpiry = () => {
        if (stopped) return;
        if (Date.now() >= expiry) return close(1008);
        // Timers use a signed 32-bit delay; longer access still follows its original expiry.
        timer = setTimeout(scheduleExpiry, Math.min(expiry - Date.now(), 2_147_483_647));
      };
      return {
        open(connected: Socket) {
          socket = connected;
          if (stopped) return connected.close(1011, "Live connection ended");
          const members = projects.get(identity.projectKey) ?? new Set();
          members.add(connection);
          projects.set(identity.projectKey, members);
          scheduleExpiry();
          connection.send({ type: "ready", protocolVersion: syncProtocolVersion });
        },
        message(data: string | Buffer) {
          if (stopped) return;
          if (Date.now() >= expiry) return close(1008);
          const parsed = parseLiveMessage(data, identity, limits);
          if (typeof parsed === "number") return close(parsed);
          if (!allow(identity.deviceId)) return close(1013);
          deliver(identity.projectKey, { type: "live", deviceId: identity.deviceId, ...parsed }, connection);
        },
        close,
      };
    },
  };
};
export type LiveHub = ReturnType<typeof createLiveHub>;
