import { z } from "zod";

export const agentAvailabilityTypeSchema = z.enum(["INSTALLED", "NOT_FOUND"]);

export const agentSkillsLayoutSchema = z.object({
  dir: z.string(),
  global_dir: z.string(),
});

export const agentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  availability: z.object({ type: agentAvailabilityTypeSchema }),
  /** Present when the harness declares skill directories. */
  skills: agentSkillsLayoutSchema.optional(),
});

export const agentModelSchema = z.object({
  id: z.string(),
});

export type AgentAvailabilityType = z.infer<typeof agentAvailabilityTypeSchema>;
export type AgentInfo = z.infer<typeof agentInfoSchema>;
export type AgentModel = z.infer<typeof agentModelSchema>;
export type AgentSkillsLayout = z.infer<typeof agentSkillsLayoutSchema>;

/** Bare provider id of a (possibly namespaced) harness id, e.g. "pstdio.harness-claude-code.claude-code" -> "claude-code". */
export const harnessLocalId = (id: string) => id.slice(id.lastIndexOf(".") + 1);
