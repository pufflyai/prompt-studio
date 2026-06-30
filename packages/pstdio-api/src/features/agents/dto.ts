import { z } from "@hono/zod-openapi";
import { agentAvailabilityTypeSchema, agentInfoSchema, agentModelSchema } from "pstdio-api-contracts";

export const checkAgentAvailabilityQuerySchema = z
  .object({
    agent: z.string().min(1).openapi({ description: "Harness id (e.g. pstdio.harness-claude-code.claude-code)" }),
    project: z.string().min(1).optional().openapi({ description: "Only consider harnesses enabled for this project" }),
  })
  .strict();

export const availabilitySchema = z.object({
  type: agentAvailabilityTypeSchema.openapi({ description: "Whether the agent is installed" }),
});

export const agentInfoResponseSchema = agentInfoSchema;
export const agentInfoListResponseSchema = z.array(agentInfoResponseSchema);
export const agentModelResponseSchema = agentModelSchema;
export const agentModelsListResponseSchema = z.array(agentModelResponseSchema);
