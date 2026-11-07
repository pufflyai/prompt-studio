import { z } from "zod";
import { type ChatRendererEvent, chatRendererEventSchema } from "./chat-renderer";

// Base64 plus the largest valid revision/length envelope stays below the public
// command stream's 64 KiB JSON chunk limit. Logical chat events keep their schema.
const PAYLOAD_BYTES = 45 * 1024;
const safeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const fragmentSchema = z.strictObject({
  revision: safeInteger,
  fragment: z.strictObject({
    index: safeInteger,
    count: safeInteger.positive(),
    byteLength: safeInteger.positive(),
    data: z
      .string()
      .min(1)
      .max((PAYLOAD_BYTES / 3) * 4)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  }),
});
export const chatRendererStreamEventSchema = z.union([chatRendererEventSchema, fragmentSchema]);
export type ChatRendererStreamEvent = z.infer<typeof chatRendererStreamEventSchema>;

const base64 = (bytes: Uint8Array) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};

const decodeLogicalEvent = (parts: Uint8Array[], byteLength: number, revision: number) => {
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  const event = chatRendererEventSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  if (event.revision !== revision) throw new Error("Chat stream fragment revision changed.");
  return event;
};

/** Write one logical event's frames in order, awaiting every stream write. */
export function* chatRendererStreamFrames(input: ChatRendererEvent) {
  const event = chatRendererEventSchema.parse(input);
  const bytes = new TextEncoder().encode(JSON.stringify(event));
  if (bytes.byteLength <= 64 * 1024) {
    yield event;
    return;
  }
  const count = Math.ceil(bytes.byteLength / PAYLOAD_BYTES);
  for (let index = 0; index < count; index++)
    yield {
      revision: event.revision,
      fragment: {
        index,
        count,
        byteLength: bytes.byteLength,
        data: base64(bytes.subarray(index * PAYLOAD_BYTES, (index + 1) * PAYLOAD_BYTES)),
      },
    };
}

/** One decoder belongs to one watch; an incomplete event never changes visible state. */
export const createChatRendererStreamDecoder = () => {
  let pending: { revision: number; count: number; byteLength: number; parts: Uint8Array[]; next: number } | undefined;
  const reset = () => {
    pending = undefined;
  };
  const readFragment = (frame: z.infer<typeof fragmentSchema>) => {
    const { index, count, byteLength, data } = frame.fragment;
    if (count !== Math.ceil(byteLength / PAYLOAD_BYTES) || index >= count)
      throw new Error("Invalid chat stream fragment dimensions.");
    if (!pending) {
      if (index !== 0) throw new Error("Chat stream fragment does not start an event.");
      pending = { revision: frame.revision, count, byteLength, parts: [], next: 0 };
    }
    if (
      pending.revision !== frame.revision ||
      pending.count !== count ||
      pending.byteLength !== byteLength ||
      pending.next !== index
    )
      throw new Error("Chat stream fragment is out of order.");
    const text = atob(data);
    if (btoa(text) !== data) throw new Error("Invalid chat stream base64.");
    const size = index === count - 1 ? byteLength - index * PAYLOAD_BYTES : PAYLOAD_BYTES;
    if (text.length !== size) throw new Error("Invalid chat stream fragment length.");
    pending.parts.push(Uint8Array.from(text, (character) => character.charCodeAt(0)));
    pending.next++;
    if (pending.next !== count) return;
    const parts = pending.parts;
    reset();
    return decodeLogicalEvent(parts, byteLength, frame.revision);
  };
  return {
    reset,
    finish: () => {
      if (pending) {
        reset();
        throw new Error("Chat stream ended with an incomplete event.");
      }
    },
    decode(value: unknown) {
      try {
        const frame = chatRendererStreamEventSchema.parse(value);
        if (!("fragment" in frame)) {
          if (pending) throw new Error("Chat stream interleaved an incomplete event.");
          return frame;
        }
        return readFragment(frame);
      } catch (error) {
        reset();
        throw error;
      }
    },
  };
};
