import { z } from "zod";
import { extensionWhenExpressionSchema, jsonObjectSchema } from "./common";

const parsedKeybindingChordSchema = z.object({
  key: z.string(),
  ctrl: z.boolean(),
  shift: z.boolean(),
  alt: z.boolean(),
  meta: z.boolean(),
  modifiers: z.array(z.string()),
});

export const extensionKeybindingRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  commandId: z.string(),
  /** Original chord string as authored, e.g. "mod+shift+p". */
  key: z.string(),
  /**
   * Platform-independent canonical chord string produced by TanStack's
   * `normalizeHotkey(input, "mac")`. Inputs like `cmd+P` and `mod+P`
   * collapse to the same value so they can be deduped at extension-check
   * time, matching what would happen at dispatch on macOS.
   */
  canonicalChord: z.string(),
  /** Result of TanStack's `parseHotkey(key, "mac")`. */
  parsed: parsedKeybindingChordSchema,
  platformOverrides: z
    .object({
      mac: z.string().optional(),
      linux: z.string().optional(),
      win: z.string().optional(),
    })
    .optional(),
  when: extensionWhenExpressionSchema.optional(),
  args: jsonObjectSchema.optional(),
});

export type ExtensionKeybindingRecord = z.infer<typeof extensionKeybindingRecordSchema>;
