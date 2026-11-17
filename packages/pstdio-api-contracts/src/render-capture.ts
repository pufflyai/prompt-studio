import { z } from "zod";

export const RENDER_CAPTURE_LIMITS = {
  durationMs: 10_000,
  names: 200,
  rows: 20,
  renders: 10_000,
  nameLength: 120,
} as const;

const duration = z.number().finite().nonnegative().nullable();
const component = z.strictObject({
  name: z.string().max(RENDER_CAPTURE_LIMITS.nameLength).nullable(),
  renders: z.number().int().positive().max(RENDER_CAPTURE_LIMITS.renders),
  unchanged: z.number().int().nonnegative().max(RENDER_CAPTURE_LIMITS.renders),
  unknown: z.number().int().nonnegative().max(RENDER_CAPTURE_LIMITS.renders),
  renderMs: duration,
  unchangedRenderMs: duration,
});

export const renderCaptureSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("recording"), startedAt: z.iso.datetime() }),
  z.strictObject({
    status: z.literal("complete"),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    components: z.array(component).max(RENDER_CAPTURE_LIMITS.rows),
    truncated: z.boolean(),
  }),
]);

export type ReactRenderCapture = z.infer<typeof renderCaptureSchema>;
export type ReactRenderSummaryRow = z.infer<typeof component>;
