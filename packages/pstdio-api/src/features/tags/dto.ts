import {
  createTagInputSchema,
  createTagOptionInputSchema,
  tagOptionSchema,
  tagSchema,
  updateTagInputSchema,
  updateTagOptionInputSchema,
} from "pstdio-api-contracts";

/** @deprecated Legacy core ticket tag DTO. Ticket tags are owned by the pstdio tickets extension. */
export const tagOptionResponseSchema = tagOptionSchema;
/** @deprecated Legacy core ticket tag DTO. Ticket tags are owned by the pstdio tickets extension. */
export const tagResponseSchema = tagSchema;

/** @deprecated Legacy core ticket tag DTO. Ticket tags are owned by the pstdio tickets extension. */
export const createTagBodySchema = createTagInputSchema.strict();
/** @deprecated Legacy core ticket tag DTO. Ticket tags are owned by the pstdio tickets extension. */
export const updateTagBodySchema = updateTagInputSchema.strict();
/** @deprecated Legacy core ticket tag DTO. Ticket tags are owned by the pstdio tickets extension. */
export const createTagOptionBodySchema = createTagOptionInputSchema.strict();
/** @deprecated Legacy core ticket tag DTO. Ticket tags are owned by the pstdio tickets extension. */
export const updateTagOptionBodySchema = updateTagOptionInputSchema.strict();
