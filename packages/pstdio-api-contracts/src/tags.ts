import { z } from "zod";

export const tagOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  sort_order: z.number(),
});

export const tagSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  type: z.string(),
  options: z.array(tagOptionSchema),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const tagTypeSchema = z.enum(["single_select", "multi_select"]);

export const createTagInputSchema = z.object({
  name: z.string(),
  type: tagTypeSchema,
  options: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
});

export const updateTagInputSchema = z.object({
  name: z.string().optional(),
  type: tagTypeSchema.optional(),
});

export const createTagOptionInputSchema = z.object({
  name: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
});

export const updateTagOptionInputSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  sort_order: z.number().optional(),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type TagOption = z.infer<typeof tagOptionSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type CreateTagInput = z.infer<typeof createTagInputSchema>;
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;
export type CreateTagOptionInput = z.infer<typeof createTagOptionInputSchema>;
export type UpdateTagOptionInput = z.infer<typeof updateTagOptionInputSchema>;
