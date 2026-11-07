import { type ChatRendererEvent, createChatRendererStreamDecoder } from "pstdio-api-contracts";

export const createChatStreamReader = (input: {
  reserve: () => number;
  accept: (event: ChatRendererEvent, issued: number) => void;
}) => {
  const decoder = createChatRendererStreamDecoder();
  let issued: number | undefined;
  const reset = () => {
    decoder.reset();
    issued = undefined;
  };
  return {
    reset,
    finish() {
      try {
        decoder.finish();
      } finally {
        reset();
      }
    },
    accept(value: unknown) {
      // Reserve the logical event's clock at its first frame. An action that
      // completes during assembly owns its newer fields at the atomic commit.
      issued ??= input.reserve();
      try {
        const event = decoder.decode(value);
        if (!event) return;
        const captured = issued;
        issued = undefined;
        input.accept(event, captured);
      } catch (error) {
        reset();
        throw error;
      }
    },
  };
};
