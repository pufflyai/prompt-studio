import { z } from "@hono/zod-openapi";

export const tagOptionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  sort_order: z.number(),
});

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  options: z.array(tagOptionResponseSchema),
});

export const createTagBodySchema = z
  .object({
    name: z.string(),
    type: z.enum(["single_select", "multi_select"]),
    options: z
      .array(
        z.object({
          name: z.string(),
          color: z.string(),
        }),
      )
      .optional(),
  })
  .strict();

export const updateTagBodySchema = z
  .object({
    name: z.string().optional(),
    type: z.enum(["single_select", "multi_select"]).optional(),
  })
  .strict();

export const createTagOptionBodySchema = z
  .object({
    name: z.string(),
    color: z.string(),
    icon: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

export const updateTagOptionBodySchema = z
  .object({
    name: z.string().optional(),
    color: z.string().optional(),
    sort_order: z.number().optional(),
    icon: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .strict();
