import { createClient, type NativeDocumentJoined } from "@pstdio/sdk/client";
import { createTextEditingClient, type TextEditingSession } from "@pstdio/sdk/extensions";

type Target = { fileRendererId: string; resource: { type: string; id: string; metadata?: { documentId: string } } };
let socket = new AbortController();
const client = createClient({
  baseUrl: location.origin,
  fetch: ((url, init) => {
    if (new URL(String(url), location.href).pathname === "/v1/session-stream") {
      socket = new AbortController();
      return fetch(url, { ...init, signal: AbortSignal.any([socket.signal, ...(init?.signal ? [init.signal] : [])]) });
    }
    return fetch(url, init);
  }) as typeof fetch,
});
const sync = client.sync.start({ getWriter: () => undefined });
const retained: {
  projectId: string;
  room: NativeDocumentJoined;
  abort: AbortController;
  watch: Promise<void>;
  session: TextEditingSession;
  guest: { close(): Promise<void> };
}[] = [];
let snapshots = 0;
let sessionEvents = 0;
let chunks = 0;
let resets = 0;
const stopSession = new AbortController();
let sessionWatch: Promise<void> | undefined;
let command: ReturnType<typeof client.extensions.streamCommand> | undefined;
let commandWatch: Promise<void> | undefined;

export const open = async (projectId: string, target: Target) => {
  const connection = await client.textEditing.connect({ projectId, scope: { kind: "agent", target } });
  const guest = connection.guest();
  const editor = createTextEditingClient(guest.host);
  const grant = await editor.current();
  if (!grant) throw new Error("Missing selected source");
  const session = await editor.open({ grant });
  const room = await client.nativeDocuments.open({ projectId, target });
  const abort = new AbortController();
  const watch = (async () => {
    while (!abort.signal.aborted) {
      try {
        await client.nativeDocuments.watch({ projectId, ...room, signal: abort.signal, onSnapshot: () => snapshots++ });
        if (!abort.signal.aborted) throw new Error("Native observation ended");
      } catch {
        if (!abort.signal.aborted) resets++;
      }
    }
  })();
  retained.push({ projectId, room, abort, watch, session, guest });
  return session.getSnapshot().text.toString();
};
export const start = async (input: { projectId: string; targets: Target[]; sessionId: string }) => {
  sessionWatch = client.sessions
    .stream(input.sessionId, () => sessionEvents++, { signal: stopSession.signal })
    .catch(() => {});
  command = client.extensions.streamCommand(input.projectId, "test.stream-fixture.command.tail");
  commandWatch = (async () => {
    for await (const _chunk of command!) chunks++;
  })().catch(() => {});
  const content = [];
  for (const target of input.targets) content.push(await open(input.projectId, target));
  return content;
};
export const state = () => ({
  snapshots,
  sessionEvents,
  chunks,
  resets,
  sync: sync.connected,
  connected: retained.every((item) => item.session.getSnapshot().connected),
});
export const drop = () => socket.abort(new DOMException("Connection lost", "AbortError"));
export const editAndClose = async () => {
  const item = retained.shift()!;
  item.session.transact((text) => text.insert(text.length, " Saved through pending close."));
  // Closing owns the flush barrier, even when its last authored frame is still in flight.
  await item.guest.close();
  item.abort.abort();
  await item.watch;
  const snapshot = await client.nativeDocuments.snapshot({ projectId: item.projectId, ...item.room });
  await client.nativeDocuments.close({ projectId: item.projectId, ...item.room });
  return snapshot.state.length;
};
let pending: { abort: AbortController; watch: Promise<void> } | undefined;
export const pendingWatch = () => {
  const item = retained[0]!;
  const abort = new AbortController();
  pending = {
    abort,
    watch: client.nativeDocuments.watch({
      projectId: item.projectId,
      ...item.room,
      signal: abort.signal,
      onSnapshot() {},
    }),
  };
};
export const cancelPending = async () => {
  pending!.abort.abort();
  await pending!.watch;
};
export const close = async () => {
  await command?.cancel();
  await commandWatch;
  stopSession.abort();
  await sessionWatch;
  for (const item of retained.splice(0)) {
    await item.guest.close();
    item.abort.abort();
    await item.watch;
    await client.nativeDocuments.close({ projectId: item.projectId, ...item.room });
  }
  sync.close();
};

export const editPeer = async () => {
  const item = retained[0]!;
  item.session.transact((text) => text.insert(text.length, " Peer event."));
  await item.session.flush();
  await item.session.project();
};
export const progress = async (projectId: string) => {
  const stream = client.extensions.streamCommand(projectId, "test.stream-fixture.command.progress");
  const received = [];
  for await (const chunk of stream) received.push(chunk);
  return received;
};
