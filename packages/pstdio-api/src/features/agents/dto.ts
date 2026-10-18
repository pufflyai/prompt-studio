import { z } from "@hono/zod-openapi";
import { agentAvailabilityTypeSchema, agentInfoSchema, agentModelSchema } from "pstdio-api-contracts";

export const agentProjectQuerySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    /** @deprecated Use projectId. */
    project: z.string().min(1).optional(),
  })
  .strict()
  .refine((input) => !input.projectId || !input.project || input.projectId === input.project, {
    message: "projectId and legacy project must match.",
  });

export const checkAgentAvailabilityQuerySchema = agentProjectQuerySchema.safeExtend({
  agent: z.string().min(1).openapi({ description: "Harness ID" }),
});

export const availabilitySchema = z.object({
  type: z.enum(agentAvailabilityTypeSchema.options).openapi({ description: "Whether the agent is installed" }),
  reason: z.string().optional().openapi({ description: "Why the agent cannot run, such as a missing or too-old CLI" }),
});

export const agentInfoResponseSchema = agentInfoSchema;
export const agentInfoListResponseSchema = z.array(agentInfoResponseSchema);
export const agentModelResponseSchema = agentModelSchema;
export const agentModelsListResponseSchema = z.array(agentModelResponseSchema);
