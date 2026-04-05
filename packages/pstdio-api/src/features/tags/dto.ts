import {
  createTagInputSchema,
  createTagOptionInputSchema,
  tagOptionSchema,
  tagSchema,
  updateTagInputSchema,
  updateTagOptionInputSchema,
} from "pstdio-api-contracts";

export const tagOptionResponseSchema = tagOptionSchema;
export const tagResponseSchema = tagSchema;

export const createTagBodySchema = createTagInputSchema.strict();
export const updateTagBodySchema = updateTagInputSchema.strict();
export const createTagOptionBodySchema = createTagOptionInputSchema.strict();
export const updateTagOptionBodySchema = updateTagOptionInputSchema.strict();
