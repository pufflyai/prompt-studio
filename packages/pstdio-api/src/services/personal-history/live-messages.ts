import { type SessionMessage, sessionMessageSchema } from "pstdio-api-contracts";
import { type SyncSpace, sealLive } from "pstdio-sync";
import type { LiveClientMessage } from "pstdio-sync-contracts";
import { z } from "zod";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

const frameSchema = z.object({
  sessionId: z.string(),
  index: z.number().int().nonnegative(),
  version: z.string(),
  offset: z.number().int().nonnegative(),
  end: z.boolean(),
  text: z.string(),
});
const framesSchema = frameSchema.array();
type Frame = z.infer<typeof frameSchema>;

/** Full live snapshots are fragmented within the relay's 64 KiB wire limit; no text is truncated or stored. */
export const createLivePublisher = (input: {
  deviceId: string;
  sessions: ExtensionsRouteDeps["sessionService"]["store"];
}) => {
  const dirty = new Set<string>();
  const snapshots = new Map<string, { index: number; version: string; text: string; offset: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const take = (id: string) => {
    let snapshot = snapshots.get(id);
    if (snapshot) return snapshot;
    const messages = input.sessions.get(id)?.conversation?.getMessages();
    const message = messages?.at(-1);
    dirty.delete(id);
    if (!message) return;
    snapshot = { index: messages!.length - 1, version: crypto.randomUUID(), text: JSON.stringify(message), offset: 0 };
    snapshots.set(id, snapshot);
    return snapshot;
  };
  const collect = () => {
    const frames: Frame[] = [];
    let bytes = 0;
    const active = [...new Set([...snapshots.keys(), ...dirty])];
    while (active.length) {
      const id = active.shift()!;
      const snapshot = take(id);
      if (!snapshot) continue;
      const text = snapshot.text.slice(snapshot.offset, snapshot.offset + 2000);
      const frame = {
        sessionId: id,
        index: snapshot.index,
        version: snapshot.version,
        offset: snapshot.offset,
        end: snapshot.offset + text.length === snapshot.text.length,
        text,
      };
      const size = Buffer.byteLength(JSON.stringify(frame)) + 1;
      if (bytes + size > 32_000) break;
      frames.push(frame);
      bytes += size;
      snapshot.offset += text.length;
      // Move each serviced session behind the others for the next tick.
      snapshots.delete(id);
      if (snapshot.offset < snapshot.text.length) {
        snapshots.set(id, snapshot);
        active.push(id);
      }
    }
    return frames;
  };
  const schedule = (space: SyncSpace, send: (message: LiveClientMessage) => void) => {
    if (timer || closed) return;
    timer = setTimeout(async () => {
      try {
        const frames = collect();
        if (frames.length) {
          const sealed = await sealLive(space, input.deviceId, new TextEncoder().encode(JSON.stringify(frames)));
          if (!closed) send(sealed);
        }
      } catch {
        // Live output is best effort. Completed messages always arrive through the durable log.
      } finally {
        timer = undefined;
        if (dirty.size || snapshots.size) schedule(space, send);
      }
    }, 250);
  };
  return {
    live(sessionId: string, space: SyncSpace, send: (message: LiveClientMessage) => void) {
      dirty.add(sessionId);
      schedule(space, send);
    },
    finish(sessionId: string) {
      dirty.delete(sessionId);
      snapshots.delete(sessionId);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      dirty.clear();
      snapshots.clear();
    },
  };
};

export const createLiveReceiver = (received: (id: string, index: number, message: SessionMessage) => void) => {
  const pending = new Map<string, { version: string; index: number; text: string }>();
  const completed = new Map<string, number>();
  return {
    completed(id: string, index: number) {
      completed.set(id, Math.max(index, completed.get(id) ?? -1));
      if ((pending.get(id)?.index ?? Infinity) <= index) pending.delete(id);
    },
    receive(value: unknown) {
      for (const frame of framesSchema.parse(value)) {
        if (frame.index <= (completed.get(frame.sessionId) ?? -1)) continue;
        if (frame.offset === 0) pending.set(frame.sessionId, { version: frame.version, index: frame.index, text: "" });
        const entry = pending.get(frame.sessionId);
        if (!entry || entry.version !== frame.version || entry.text.length !== frame.offset) continue;
        entry.text += frame.text;
        if (!frame.end) continue;
        pending.delete(frame.sessionId);
        received(frame.sessionId, frame.index, sessionMessageSchema.parse(JSON.parse(entry.text)));
      }
    },
    reset() {
      pending.clear();
    },
    close() {
      pending.clear();
      completed.clear();
    },
  };
};
