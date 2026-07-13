import { z } from "zod";

export const agentAvailabilityTypeSchema = z.enum(["INSTALLED", "NOT_FOUND"]);

export const agentSkillsLayoutSchema = z.object({
  dir: z.string(),
  global_dir: z.string(),
});

const harnessParamBaseSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const harnessParamOptionSchema = z.object({ label: z.string(), value: z.string(), icon: z.string().optional() });

export const harnessSelectParamSchema = harnessParamBaseSchema.extend({
  type: z.literal("select"),
  defaultValue: z.string().optional(),
  options: z.array(harnessParamOptionSchema),
});

export const harnessBooleanParamSchema = harnessParamBaseSchema.extend({
  type: z.literal("boolean"),
  defaultValue: z.boolean().optional(),
});

export const harnessParamDescriptorSchema = z.union([harnessSelectParamSchema, harnessBooleanParamSchema]);
export const harnessParamsSchema = z.record(z.string(), harnessParamDescriptorSchema);

export const agentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  availability: z.object({ type: agentAvailabilityTypeSchema }),
  /** Present when the harness declares skill directories. */
  skills: agentSkillsLayoutSchema.optional(),
  /** Present when the harness declares discrete run params. */
  params: harnessParamsSchema.optional(),
});

export const agentModelSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  paramOverrides: z.record(z.string(), harnessParamDescriptorSchema.nullable()).optional(),
});

export type AgentAvailabilityType = z.infer<typeof agentAvailabilityTypeSchema>;
export type AgentInfo = z.infer<typeof agentInfoSchema>;
export type AgentModel = z.infer<typeof agentModelSchema>;
export type AgentSkillsLayout = z.infer<typeof agentSkillsLayoutSchema>;
export type HarnessParamDescriptorInfo = z.infer<typeof harnessParamDescriptorSchema>;
export type HarnessParamsInfo = z.infer<typeof harnessParamsSchema>;

export { findAgentModel, resolveAgentModelParams } from "./agent-model-params";

/** Bare provider id of a (possibly namespaced) harness id, e.g. "pstdio.harness-claude-code.claude-code" -> "claude-code". */
export const harnessLocalId = (id: string) => id.slice(id.lastIndexOf(".") + 1);
