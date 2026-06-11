import { z } from "zod";

export const agentAvailabilityTypeSchema = z.enum(["INSTALLED", "NOT_FOUND"]);

export const agentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  availability: z.object({ type: agentAvailabilityTypeSchema }),
});

export const agentModelSchema = z.object({
  id: z.string(),
});

export type AgentAvailabilityType = z.infer<typeof agentAvailabilityTypeSchema>;
export type AgentInfo = z.infer<typeof agentInfoSchema>;
export type AgentModel = z.infer<typeof agentModelSchema>;
