import { z } from "zod";

export const panelEdgeSchema = z.enum(["left", "right", "top", "bottom"]);
const column = z
  .object({
    axis: z.literal("vertical"),
    children: z.union([
      z.tuple([z.literal("main"), z.literal("secondary")]),
      z.tuple([z.literal("secondary"), z.literal("main")]),
    ]),
  })
  .strict();
const content = z
  .object({
    axis: z.literal("horizontal"),
    children: z.union([z.tuple([z.literal("side"), column]), z.tuple([column, z.literal("side")])]),
  })
  .strict();
export const modeLayoutSchema = z
  .object({
    axis: z.literal("horizontal"),
    children: z.union([z.tuple([z.literal("sidenav"), content]), z.tuple([content, z.literal("sidenav")])]),
  })
  .strict();
