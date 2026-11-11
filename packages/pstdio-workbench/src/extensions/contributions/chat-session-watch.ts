import type { createChatEventReader } from "./chat-event-reader";
import type { ChatSessionInput } from "./chat-session";

const overflowed = (error: unknown) => (error as { code?: unknown } | null)?.code === "command_stream_overflow";

const waitForRecovery = (signal: AbortSignal, delay: number) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });

const watchOnce = async (
  watch: NonNullable<ChatSessionInput["watch"]>,
  signal: AbortSignal,
  active: () => boolean,
  reader: ReturnType<typeof createChatEventReader>,
  fail: (error: unknown) => (cause?: unknown) => void,
) => {
  let replaceIncomplete: ((cause: unknown) => void) | undefined;
  let incomplete = false;
  let result: Promise<unknown> | undefined;
  let resultFailure: { error: unknown } | undefined;
  try {
    const stream = watch(signal);
    result = stream.result;
    // Command failure can end the iterator normally, with its cause available
    // only through result. Keep incomplete assembly prompt even if result hangs.
    void result?.catch((error: unknown) => {
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
    await result;
  } catch (error) {
    if (!active()) return;
    reader.reset();
    if (overflowed(error)) return error;
    const replace = fail(error);
    if (incomplete && !resultFailure && result)
      return await new Promise<unknown>((resolve) => {
        const finish = (overflow?: unknown) => {
          signal.removeEventListener("abort", abort);
          resolve(overflow);
        };
        const abort = () => finish();
        replaceIncomplete = (cause) => {
          if (!active()) return finish();
          const overflow = overflowed(cause);
          replace(overflow ? undefined : cause);
          finish(overflow ? cause : undefined);
        };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
  }
};

/** Observation can restart from a canonical snapshot without replaying user actions. */
export const watchChatSession = async (
  watch: NonNullable<ChatSessionInput["watch"]>,
  signal: AbortSignal,
  active: () => boolean,
  reader: ReturnType<typeof createChatEventReader>,
  fail: (error: unknown) => (cause?: unknown) => void,
) => {
  let delay = 1000;
  while (active()) {
    const overflow = await watchOnce(watch, signal, active, reader, fail);
    if (!overflow || !active()) return;
    console.warn("Conversation observation overflowed; reconnecting.", overflow);
    await waitForRecovery(signal, delay);
    if (!active()) return;
    reader.restart();
    delay = Math.min(delay * 2, 30_000);
  }
};
