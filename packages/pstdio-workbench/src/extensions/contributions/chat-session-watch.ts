import type { ChatSessionInput } from "./chat-session";
import type { createChatStreamReader } from "./chat-stream-reader";

export const watchChatSession = async (
  watch: NonNullable<ChatSessionInput["watch"]>,
  signal: AbortSignal,
  active: () => boolean,
  reader: ReturnType<typeof createChatStreamReader>,
  fail: (error: unknown) => (cause: unknown) => void,
) => {
  let replaceIncomplete: ((cause: unknown) => void) | undefined;
  let incomplete = false;
  let resultFailure: { error: unknown } | undefined;
  try {
    const stream = watch(signal);
    // Command failure can end the iterator normally, with its cause available
    // only through result. Keep incomplete assembly prompt even if result hangs.
    void stream.result?.catch((error: unknown) => {
      resultFailure = { error };
      if (active()) replaceIncomplete?.(error);
    });
    for await (const event of stream) {
      if (signal.aborted) break;
      if (active()) reader.accept(event);
    }
    if (active()) {
      try {
        reader.finish();
      } catch (error) {
        incomplete = true;
        throw resultFailure ? resultFailure.error : error;
      }
    }
    await stream.result;
  } catch (error) {
    if (active()) {
      reader.reset();
      const replace = fail(error);
      if (incomplete && !resultFailure) replaceIncomplete = replace;
    }
  }
};
