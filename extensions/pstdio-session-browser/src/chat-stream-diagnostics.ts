import { randomUUID } from "node:crypto";
import { channel } from "node:diagnostics_channel";
import { type ChatRendererEvent, chatRendererStreamFrames } from "@pstdio/sdk/extensions";

const operations = channel("pstdio.diagnostics.operation");

/** Measure generator work separately from awaiting the consumer's stream writes. */
export function* diagnosticChatFrames(sessionId: string, event: ChatRendererEvent) {
  const frames = chatRendererStreamFrames(event);
  if (!operations.hasSubscribers) {
    yield* frames;
    return;
  }
  const startedAt = new Date().toISOString();
  const id = randomUUID();
  let durationMs = 0;
  let logicalBytes = 0;
  let wireBytes = 0;
  let fragments = 0;
  let completed = false;
  const publish = (complete: boolean, failed = false) =>
    operations.publish({
      kind: "chat.encode",
      id,
      startedAt,
      durationMs,
      sessionId,
      revision: event.revision,
      logicalBytes,
      wireBytes,
      fragments,
      complete,
      failed,
    });
  try {
    while (true) {
      const start = performance.now();
      let next: ReturnType<typeof frames.next>;
      try {
        next = frames.next();
      } finally {
        durationMs += performance.now() - start;
      }
      if (next.done) break;
      const bytes = Buffer.byteLength(JSON.stringify(next.value));
      wireBytes += bytes;
      logicalBytes = "fragment" in next.value ? next.value.fragment.byteLength : bytes;
      fragments++;
      publish(false);
      yield next.value;
    }
    completed = true;
  } finally {
    frames.return();
    publish(completed, !completed);
  }
}
