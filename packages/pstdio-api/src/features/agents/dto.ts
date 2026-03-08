import { z } from "@hono/zod-openapi";

export const checkAgentAvailabilityQuerySchema = z
  .object({
    agent: z.string().min(1).openapi({ description: "Agent identifier (e.g. claude-code, opencode)" }),
  })
  .strict();

export const availabilitySchema = z.object({
  type: z.enum(["INSTALLED", "NOT_FOUND"]).openapi({ description: "Whether the agent is installed" }),
});

export const agentConfigResponseSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  is_default: z.boolean(),
  config: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const agentConfigListResponseSchema = z.array(agentConfigResponseSchema);

export const setupAgentBodySchema = z
  .object({
    agent_id: z.string().min(1).openapi({ description: "Agent identifier (e.g. claude-code, opencode)" }),
  })
  .strict();

export const updateAgentBodySchema = z
  .object({
    is_default: z.boolean().optional().openapi({ description: "Set as the default agent" }),
    binary: z.string().optional().openapi({ description: "Override the agent binary path" }),
    skills_dir: z.string().optional().openapi({ description: "Override the agent skills directory" }),
  })
  .strict();

export const notFoundResponseSchema = z.object({
  error: z.string(),
});
