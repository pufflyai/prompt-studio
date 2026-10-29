import { z } from "zod";

const rect = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
});
const action = z.object({ id: z.string().min(1), label: z.string(), disabled: z.boolean().optional() });
export const webviewOverlayParamsSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("show"),
    id: z.string().min(1),
    anchor: rect,
    placement: z
      .enum([
        "top",
        "right",
        "bottom",
        "left",
        "top-start",
        "top-end",
        "right-start",
        "right-end",
        "bottom-start",
        "bottom-end",
        "left-start",
        "left-end",
      ])
      .optional(),
    content: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("tooltip"), text: z.string() }),
      z.object({ kind: z.literal("menu"), label: z.string(), items: z.array(action) }),
      z.object({
        kind: z.literal("popover"),
        title: z.string(),
        text: z.string(),
        actions: z.array(action).optional(),
      }),
    ]),
  }),
  z.object({ op: z.literal("move"), id: z.string(), anchor: rect }),
  z.object({ op: z.literal("close"), id: z.string() }),
]);
