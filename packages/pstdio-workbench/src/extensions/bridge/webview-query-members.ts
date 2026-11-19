import type { WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { runQueryCallbacks } from "./webview-query-cleanup";
import type { WebviewQuerySource } from "./webview-query-source";

interface Member {
  owner: string;
  close(): void;
}
const connections = new WeakMap<HostEventPublisher, Map<string, Member>>();
const connection = (events: HostEventPublisher) => {
  let members = connections.get(events);
  if (members) return members;
  members = new Map();
  connections.set(events, members);
  const owned = members;
  events.onDisconnect(() => runQueryCallbacks([...owned.values()].map((member) => member.close)));
  return members;
};
/** A subscription and an explicit read have independent memberships, including cancellation. */
export const serveWebviewQuery = async (input: {
  channel: string;
  events: HostEventPublisher;
  owner: string;
  request: { owner: string; requestId: string; operation: "observe" | "read" | "refresh" | "close" };
  requireCurrent(): void;
  source(): WebviewQuerySource;
  subscribeClose?(close: () => void): () => void;
}) => {
  const { request, events } = input;
  const members = connection(events);
  const key = JSON.stringify([input.channel, request.requestId]);
  if (request.operation === "close") {
    const member = members.get(key);
    if (member?.owner === request.owner) member.close();
    return;
  }
  if (request.owner !== input.owner) throw new Error("Retained query authority is closed");
  input.requireCurrent();
  if (members.has(key)) throw new Error("Retained query request already exists");
  const source = input.source();
  let closed = false;
  let stop = () => {};
  let stopAuthority = () => {};
  const settled = Promise.withResolvers<WebviewCommandQuerySnapshot>();
  void settled.promise.catch(() => {});
  const member: Member = {
    owner: input.owner,
    close() {
      if (closed) return;
      closed = true;
      if (members.get(key) === member) members.delete(key);
      runQueryCallbacks([stop, stopAuthority, () => settled.reject(new Error("Retained query request is closed"))]);
    },
  };
  members.set(key, member);
  stopAuthority = input.subscribeClose?.(member.close) ?? (() => {});
  const changed = () => {
    if (closed) return;
    try {
      input.requireCurrent();
    } catch {
      // The identity source may survive authority retirement. Revoke this projection only.
      const previous = source.snapshot();
      const snapshot = {
        generation: previous.generation,
        version: previous.version + 1,
        stale: false,
        fetching: false,
        retired: true as const,
      };
      try {
        if (request.operation === "observe")
          events.emit({ scope: input.channel, payload: { requestId: request.requestId, snapshot } });
        else settled.resolve(snapshot);
      } finally {
        member.close();
      }
      return;
    }
    const snapshot = source.snapshot();
    if (request.operation === "observe") {
      try {
        events.emit({ scope: input.channel, payload: { requestId: request.requestId, snapshot } });
      } finally {
        if (snapshot.retired) member.close();
      }
    } else if (
      snapshot.retired ||
      (!snapshot.fetching && !snapshot.stale && (snapshot.data !== undefined || snapshot.error))
    )
      settled.resolve(snapshot);
  };
  try {
    if (request.operation === "refresh") source.query.invalidate();
    if (closed) throw new Error("Retained query request is closed");
    input.requireCurrent();
    stop = source.observe(changed);
    if (closed) stop();
    else changed();
    if (request.operation === "observe") {
      if (closed) throw new Error("Retained query request is closed");
      return source.snapshot();
    }
    return await settled.promise;
  } catch (error) {
    member.close();
    throw error;
  } finally {
    if (request.operation !== "observe") member.close();
  }
};
