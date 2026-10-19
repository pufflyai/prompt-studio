import { z } from "zod";
import { canonicalJson } from "./fingerprint";
import { environmentTargetSchema } from "./identity";
import type { StoredRecord } from "./state";
import { identitySchema } from "./wire";

export const automationsId = "pstdio.automations";
export const automationRunsId = "pstdio.automation-runs";
export const automationDefinitionSchema = z.strictObject({
  kind: z.literal("definition"),
  scheduleId: identitySchema,
  extensionId: identitySchema,
  target: environmentTargetSchema,
  enabled: z.boolean(),
  startsAt: z.iso.datetime(),
});
export const automationApplicationSchema = z.strictObject({
  kind: z.literal("application"),
  scheduleId: identitySchema,
  environmentId: identitySchema,
  definition: z.string(),
});
export const automationRecordSchema = z.discriminatedUnion("kind", [
  automationDefinitionSchema,
  automationApplicationSchema,
]);
export type AutomationDefinition = z.infer<typeof automationDefinitionSchema>;
export const automationDefinitionId = (scheduleId: string) => JSON.stringify(["definition", scheduleId]);
export const automationApplicationId = (scheduleId: string) => JSON.stringify(["application", scheduleId]);
export const automationRunId = (workbenchId: string, scheduleId: string, scheduledFor: string) =>
  JSON.stringify([workbenchId, scheduleId, scheduledFor]);

// The relay enforces these rules independently of the authoring host.
export const validateAutomationRecord = (
  record: StoredRecord,
  previous: StoredRecord | undefined,
  environmentId: string,
  workbenchId: string,
) => {
  if (record.deleted || record.primitive || record.asset)
    throw new Error("Automation records cannot be deleted or converted");
  const value = automationRecordSchema.parse(record.value);
  if (value.kind === "application") {
    if (record.recordId !== automationApplicationId(value.scheduleId) || value.environmentId !== environmentId)
      throw new Error("Automation application must come from its environment");
    return value;
  }
  if (record.recordId !== automationDefinitionId(value.scheduleId) || value.target.workbenchId !== workbenchId)
    throw new Error("Automation identity and target workbench must agree");
  if (!previous && value.target.environmentId !== environmentId)
    throw new Error("Assign the automation on its target environment");
  if (previous) {
    const before = automationDefinitionSchema.parse(previous.value);
    if (canonicalJson({ ...before, enabled: value.enabled }) !== canonicalJson(value))
      throw new Error("Automation target and identity are immutable");
  }
  return value;
};
