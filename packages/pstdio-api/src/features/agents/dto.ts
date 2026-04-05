import { z } from "@hono/zod-openapi";
import {
  agentAvailabilityTypeSchema,
  agentConfigSchema,
  agentInfoSchema,
  agentModelSchema,
  setupAgentInputSchema,
  updateAgentInputSchema,
} from "pstdio-api-contracts";

export const checkAgentAvailabilityQuerySchema = z
  .object({
    agent: z.string().min(1).openapi({ description: "Agent identifier (e.g. claude-code, opencode)" }),
  })
  .strict();

export const availabilitySchema = z.object({
  type: agentAvailabilityTypeSchema.openapi({ description: "Whether the agent is installed" }),
});

export const agentConfigResponseSchema = agentConfigSchema;
export const agentConfigListResponseSchema = z.array(agentConfigResponseSchema);
export const agentInfoResponseSchema = agentInfoSchema;
export const agentInfoListResponseSchema = z.array(agentInfoResponseSchema);
export const agentModelResponseSchema = agentModelSchema;
export const agentModelsListResponseSchema = z.array(agentModelResponseSchema);

export const setupAgentBodySchema = setupAgentInputSchema.strict();
export const updateAgentBodySchema = updateAgentInputSchema.strict();

export const notFoundResponseSchema = z.object({ error: z.string() });
