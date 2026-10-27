import {
  type NativeDocumentJoined as JoinedWire,
  type NativeDocumentSelection,
  type NativeDocumentTarget,
  type NativePresenceSnapshot,
  nativeDocumentJoinedSchema,
  nativeDocumentSnapshotSchema,
  nativePresenceSnapshotSchema,
  type NativeDocumentSnapshot as SnapshotWire,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";
import { readSseStream } from "./sse";

export type NativeDocumentSnapshot = Omit<SnapshotWire, "state" | "sourceState"> & {
  state: Uint8Array;
  sourceState?: Uint8Array;
};
export type NativeDocumentJoined = Omit<JoinedWire, "state" | "sourceState"> & {
  state: Uint8Array;
  sourceState?: Uint8Array;
};

interface RoomRequest {
  projectId: string;
  documentKey: string;
  roomId: string;
  signal?: AbortSignal;
}
const encode = (bytes: Uint8Array | undefined) => {
  if (!bytes) return undefined;
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
  return btoa(chunks.join(""));
};
const decode = <T extends SnapshotWire>(value: T) => ({
  ...value,
  state: Uint8Array.from(atob(value.state), (character) => character.charCodeAt(0)),
  sourceState: value.sourceState
    ? Uint8Array.from(atob(value.sourceState), (character) => character.charCodeAt(0))
    : undefined,
});
const base = (projectId: string) => `/v1/projects/${encodeURIComponent(projectId)}/native-documents`;
const roomPath = (input: RoomRequest) =>
  `${base(input.projectId)}/${encodeURIComponent(input.documentKey)}?roomId=${encodeURIComponent(input.roomId)}`;

export const createNativeDocumentsClient = (request: RequestFn) => ({
  async open(input: {
    projectId: string;
    target: NativeDocumentTarget;
    sourceState?: Uint8Array;
    pendingUpdate?: Uint8Array;
    signal?: AbortSignal;
  }) {
    const result = await request<unknown>(base(input.projectId), {
      method: "POST",
      signal: input.signal,
      body: { ...input.target, sourceState: encode(input.sourceState), pendingUpdate: encode(input.pendingUpdate) },
    });
    return decode(nativeDocumentJoinedSchema.parse(result));
  },
  async submit(input: RoomRequest & { update: Uint8Array }) {
    const result = await request<unknown>(`${base(input.projectId)}/${encodeURIComponent(input.documentKey)}/updates`, {
      method: "POST",
      signal: input.signal,
      body: { roomId: input.roomId, update: encode(input.update) },
    });
    return decode(nativeDocumentSnapshotSchema.parse(result));
  },
  async snapshot(input: RoomRequest) {
    return decode(
      nativeDocumentSnapshotSchema.parse(await request<unknown>(roomPath(input), { signal: input.signal })),
    );
  },
  async watch(
    input: RoomRequest & {
      onSnapshot: (snapshot: NativeDocumentSnapshot) => void;
      onPresence?: (snapshot: NativePresenceSnapshot) => void;
    },
  ) {
    const body = await request<ReadableStream<Uint8Array>>(
      `${base(input.projectId)}/${encodeURIComponent(input.documentKey)}/stream?roomId=${encodeURIComponent(input.roomId)}`,
      { signal: input.signal, response: "stream" },
    );
    await readSseStream(
      body,
      (event) => {
        if (event.event === "document")
          input.onSnapshot(decode(nativeDocumentSnapshotSchema.parse(JSON.parse(event.data))));
        if (event.event === "presence") input.onPresence?.(nativePresenceSnapshotSchema.parse(JSON.parse(event.data)));
      },
      { signal: input.signal },
    );
  },
  presence: (input: RoomRequest & { participantId: string; seedId: string; selection: NativeDocumentSelection }) =>
    request<{ updated: true }>(`${base(input.projectId)}/${encodeURIComponent(input.documentKey)}/presence`, {
      method: "POST",
      signal: input.signal,
      body: {
        roomId: input.roomId,
        participantId: input.participantId,
        seedId: input.seedId,
        selection: input.selection,
      },
    }),
  close: (input: RoomRequest) =>
    request<{ closed: boolean }>(roomPath(input), { method: "DELETE", signal: input.signal }),
});

export type NativeDocumentsClient = ReturnType<typeof createNativeDocumentsClient>;
