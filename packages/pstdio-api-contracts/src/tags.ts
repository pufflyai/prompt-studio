import { z } from "zod";

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export const tagOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  sort_order: z.number(),
});

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
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

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export const tagTypeSchema = z.enum(["single_select", "multi_select"]);

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export const createTagInputSchema = z.object({
  name: z.string(),
  type: tagTypeSchema,
  options: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
});

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export const updateTagInputSchema = z.object({
  name: z.string().optional(),
  type: tagTypeSchema.optional(),
});

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export const createTagOptionInputSchema = z.object({
  name: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
});

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export const updateTagOptionInputSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  sort_order: z.number().optional(),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export type TagOption = z.infer<typeof tagOptionSchema>;
/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export type Tag = z.infer<typeof tagSchema>;
/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export type CreateTagInput = z.infer<typeof createTagInputSchema>;
/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;
/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export type CreateTagOptionInput = z.infer<typeof createTagOptionInputSchema>;
/** @deprecated Legacy core ticket tag data. Ticket tags are owned by the pstdio tickets extension. */
export type UpdateTagOptionInput = z.infer<typeof updateTagOptionInputSchema>;
