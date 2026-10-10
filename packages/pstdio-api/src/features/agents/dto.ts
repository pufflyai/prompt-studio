import { z } from "@hono/zod-openapi";
import { agentAvailabilityTypeSchema, agentInfoSchema, agentModelSchema } from "pstdio-api-contracts";

export const checkAgentAvailabilityQuerySchema = z
  .object({
    agent: z
      .string()
      .min(1)
      .openapi({ description: "Harness id (e.g. pstdio.harness-claude-code.harness.claude-code)" }),
    project: z.string().min(1).optional().openapi({ description: "Only consider harnesses enabled for this project" }),
  })
  .strict();

export const availabilitySchema = z.object({
  type: z.enum(agentAvailabilityTypeSchema.options).openapi({ description: "Whether the agent is installed" }),
  reason: z.string().optional().openapi({ description: "Why the agent cannot run, such as a missing or too-old CLI" }),
});

export const agentInfoResponseSchema = agentInfoSchema;
export const agentInfoListResponseSchema = z.array(agentInfoResponseSchema);
export const agentModelResponseSchema = agentModelSchema;
export const agentModelsListResponseSchema = z.array(agentModelResponseSchema);
