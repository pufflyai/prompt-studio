import { z } from "zod";

export const agentAvailabilityTypeSchema = z.enum(["INSTALLED", "NOT_FOUND"]);

export const agentConfigSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  is_default: z.boolean(),
  config: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const agentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  availability: z.object({ type: agentAvailabilityTypeSchema }),
});

export const agentModelSchema = z.object({
  id: z.string(),
});

export const setupAgentInputSchema = z.object({
  agent_id: z.string().min(1),
  binary: z.string().min(1).optional(),
});

export const updateAgentInputSchema = z.object({
  is_default: z.boolean().optional(),
  binary: z.string().optional(),
  skills_dir: z.string().optional(),
});

export const setupAvailableAgentsInputSchema = z.object({
  default_agent_id: z.string(),
});

export type AgentAvailabilityType = z.infer<typeof agentAvailabilityTypeSchema>;
export type SetupAvailableAgentsInput = z.infer<typeof setupAvailableAgentsInputSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentInfo = z.infer<typeof agentInfoSchema>;
export type AgentModel = z.infer<typeof agentModelSchema>;
export type SetupAgentInput = z.infer<typeof setupAgentInputSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentInputSchema>;
