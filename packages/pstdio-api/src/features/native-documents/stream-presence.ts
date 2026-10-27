import type { createNativeDocumentService } from "../../services/native-documents/documents";
import { NativePresenceError } from "../../services/native-documents/presence";

export const openNativePresenceStream = async (
  service: ReturnType<typeof createNativeDocumentService>,
  room: { projectId: string; roomId: string; documentKey: string; seedId: string },
  write: (event: { event: string; data: string }) => Promise<unknown>,
  failed: (error: unknown) => void,
) => {
  const connection = await service.presence.join(room).catch((error) => {
    // The live room allowance must not interrupt the durable text stream.
    if (error instanceof NativePresenceError && error.code === "room_limit") return undefined;
    throw error;
  });
  if (!connection) return undefined;
  let stopped = false;
  let dirty = true;
  let draining = false;
  let stop: (() => void) | undefined;
  const close = () => {
    if (stopped) return;
    stopped = true;
    stop?.();
    connection.close();
  };
  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (dirty && !stopped) {
        dirty = false;
        await write({
          event: "presence",
          data: JSON.stringify({
            participantId: connection.participantId,
            participants: connection.snapshot(),
          }),
        });
      }
    } finally {
      draining = false;
    }
  };
  try {
    stop = connection.watch(() => {
      dirty = true;
      void drain().catch(failed);
    });
    await drain();
    return { close };
  } catch (error) {
    close();
    throw error;
  }
};
