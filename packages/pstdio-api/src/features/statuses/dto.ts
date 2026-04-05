import { createStatusInputSchema, statusSchema } from "pstdio-api-contracts";

export const statusResponseSchema = statusSchema;
export const createStatusBodySchema = createStatusInputSchema.strict();
