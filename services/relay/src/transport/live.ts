import type { ServerWebSocket } from "bun";
import {
  type LiveClientMessage,
  type LiveServerMessage,
  liveClientMessageSchema,
  liveProtocolVersion,
} from "pstdio-sync-contracts";
import type { RelayLimits } from "../limits";
import type { DocumentChange } from "../storage/documents";
import { createLiveCalls, liveKey } from "./live-calls";
import type { RateLimit } from "./rate-limit";

type Socket = Pick<ServerWebSocket, "send" | "close">;
export interface LiveIdentity {
  projectKey: string;
  accountId: string;
  deviceId: string;
  expiresAt: string;
}
interface LiveConnection extends LiveIdentity {
  subscriptions: Set<string>;
  followers: Map<string, boolean>;
  discovery: Set<string | null>;
  registrations: Set<string>;
  send(message: LiveServerMessage): void;
  close(code?: number): void;
}
const canRead = (connection: LiveIdentity, spaceOwner: string | null) =>
  spaceOwner === null || spaceOwner === connection.accountId;

const parse = (data: string | Buffer, limits: RelayLimits, identity: LiveIdentity) => {
  if (typeof data !== "string" || Buffer.byteLength(data) > limits.maxLiveMessageBytes * 2 + 4096) return 1009;
  let input: unknown;
  try {
    input = JSON.parse(data);
  } catch {
    return 1008;
  }
  const parsed = liveClientMessageSchema.safeParse(input);
  if (!parsed.success) return 1008;
  const message = parsed.data;
  if ("spaceOwner" in message && !canRead(identity, message.spaceOwner)) return 1008;
  if ("payload" in message && Buffer.byteLength(message.payload, "base64") > limits.maxLiveMessageBytes) return 1009;
  return message;
};

/** Connection-owned state only. No persisted payloads, delivery queues or heartbeat polling (R31). */
export const createLiveHub = (limits: RelayLimits, allow: RateLimit) => {
  const projects = new Map<string, Set<LiveConnection>>();
  const members = (project: string) => projects.get(project) ?? new Set<LiveConnection>();
  const calls = createLiveCalls(limits.maxLiveCalls, members);
  const notify = (project: string) => {
    for (const follower of members(project)) {
      for (const [key, previous] of follower.followers) {
        const active = [...members(project)].some(
          (reader) => reader.deviceId !== follower.deviceId && reader.subscriptions.has(key),
        );
        if (active === previous) continue;
        follower.followers.set(key, active);
        const [spaceOwner, topic] = JSON.parse(key);
        follower.send({ type: "subscribers", spaceOwner, topic, active });
      }
    }
  };
  return {
    changed({ projectKey, spaceOwner, documentId, lastSequence, stateId, created }: DocumentChange) {
      const key = liveKey(spaceOwner, documentId);
      for (const connection of members(projectKey))
        if (
          canRead(connection, spaceOwner) &&
          (connection.subscriptions.has(key) || (created && connection.discovery.has(spaceOwner)))
        )
          connection.send({
            type: connection.subscriptions.has(key) ? "changed" : "discovered",
            spaceOwner,
            documentId,
            lastSequence,
            stateId,
          });
    },
    connect(identity: LiveIdentity) {
      let socket: Socket | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      const close = (code = 1000) => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        const group = projects.get(identity.projectKey);
        group?.delete(connection);
        if (group?.size === 0) projects.delete(identity.projectKey);
        calls.close(connection);
        notify(identity.projectKey);
        socket?.close(code, code === 1008 ? "Live message refused" : "Live connection ended");
      };
      const connection: LiveConnection = {
        ...identity,
        subscriptions: new Set(),
        followers: new Map(),
        discovery: new Set(),
        registrations: new Set(),
        close,
        send(message) {
          // A slow consumer reconnects and reads documents; no payload queue is retained.
          if (!stopped && socket && socket.send(JSON.stringify(message)) <= 0) close(1013);
        },
      };
      const expiry = new Date(identity.expiresAt).getTime();
      const scheduleExpiry = () => {
        if (stopped) return;
        if (Date.now() >= expiry) return close(1008);
        timer = setTimeout(scheduleExpiry, Math.min(expiry - Date.now(), 2_147_483_647));
      };
      const bound = () => {
        if (
          connection.subscriptions.size +
            connection.followers.size +
            connection.registrations.size +
            connection.discovery.size >
          limits.maxLiveSubscriptions
        )
          close(1013);
      };
      const publish = (message: Extract<LiveClientMessage, { type: "publish" }>) => {
        const key = liveKey(message.spaceOwner, message.topic);
        for (const reader of members(identity.projectKey))
          if (reader !== connection && canRead(reader, message.spaceOwner) && reader.subscriptions.has(key))
            reader.send({ ...message, type: "event", deviceId: identity.deviceId });
      };
      const topicMessage = (message: Extract<LiveClientMessage, { topic: string }>) => {
        const key = liveKey(message.spaceOwner, message.topic);
        if (message.type === "subscribe") connection.subscriptions.add(key);
        if (message.type === "unsubscribe") connection.subscriptions.delete(key);
        if (message.type === "unfollow") connection.followers.delete(key);
        if (message.type === "follow") {
          const active = [...members(identity.projectKey)].some(
            (reader) => reader.deviceId !== identity.deviceId && reader.subscriptions.has(key),
          );
          connection.followers.set(key, active);
          connection.send({ type: "subscribers", spaceOwner: message.spaceOwner, topic: message.topic, active });
        }
        if (message.type === "publish") publish(message);
        if (message.type === "subscribe" || message.type === "unsubscribe") notify(identity.projectKey);
      };
      const dispatch = (message: LiveClientMessage) => {
        if ("topic" in message) topicMessage(message);
        else if (message.type === "discover" || message.type === "undiscover") {
          if (message.type === "discover") connection.discovery.add(message.spaceOwner);
          else connection.discovery.delete(message.spaceOwner);
        } else if (message.type === "register" || message.type === "unregister") {
          const key = liveKey(message.spaceOwner, message.procedure);
          if (message.type === "register") connection.registrations.add(key);
          else connection.registrations.delete(key);
        } else if (!calls.message(connection, message)) close(1008);
        bound();
      };
      return {
        open(connected: Socket) {
          socket = connected;
          if (stopped) return connected.close(1011, "Live connection ended");
          // Renewals replace the old device connection before accepting traffic.
          for (const previous of members(identity.projectKey))
            if (previous.deviceId === identity.deviceId) previous.close();
          const group = members(identity.projectKey);
          group.add(connection);
          projects.set(identity.projectKey, group);
          scheduleExpiry();
          connection.send({ type: "ready", protocolVersion: liveProtocolVersion });
        },
        message(data: string | Buffer) {
          if (stopped) return;
          if (Date.now() >= expiry) return close(1008);
          const message = parse(data, limits, identity);
          if (typeof message === "number") return close(message);
          if (!allow(identity.deviceId)) return close(1013);
          dispatch(message);
        },
        close,
      };
    },
  };
};
export type LiveHub = ReturnType<typeof createLiveHub>;
