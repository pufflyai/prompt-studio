import { createStatusInputSchema, statusSchema } from "pstdio-api-contracts";

/** @deprecated Legacy core ticket status DTO. Ticket statuses are owned by the pstdio tickets extension. */
export const statusResponseSchema = statusSchema;
/** @deprecated Legacy core ticket status DTO. Ticket statuses are owned by the pstdio tickets extension. */
export const createStatusBodySchema = createStatusInputSchema.strict();
