import { z } from "zod";
import type { CommandOutcome, JsonValue, NavigationTarget } from "../extension-kernel";
import { serializableJsonObjectSchema } from "./common";
import { navigationTargetSchema } from "./navigation-target-metadata";

const notice = z.object({
  type: z.enum(["info", "success", "warning", "error"]),
  title: z.string().optional(),
  message: z.string(),
  metadata: serializableJsonObjectSchema.optional(),
});
const diagnostic = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  extensionId: z.string().optional(),
  commandId: z.string().optional(),
  metadata: serializableJsonObjectSchema.optional(),
});
export const createCommandOutcomeSchema = (jsonValue: z.ZodType<JsonValue>) => {
  const error = z.object({
    name: z.string().optional(),
    message: z.string(),
    stack: z.string().optional(),
    cause: jsonValue.optional(),
  });
  const annotations = {
    notices: z.array(notice).optional(),
    diagnostics: z.array(diagnostic).optional(),
  };
  const failure = {
    ...annotations,
    ok: z.literal(false),
    code: z.string().optional(),
    reason: z.string(),
    data: serializableJsonObjectSchema.optional(),
    cause: jsonValue.optional(),
    error: error.optional(),
  };
  const navigation: z.ZodType<NavigationTarget> = navigationTargetSchema;

  const outcome: z.ZodType<CommandOutcome> = z.discriminatedUnion("status", [
    z
      .object({
        ...annotations,
        ok: z.literal(true),
        status: z.literal("success"),
        value: z.unknown().optional(),
        navigationRequests: z.array(navigation).optional(),
      })
      .transform((outcome) => ({ ...outcome, value: outcome.value })),
    z.object({ ...failure, status: z.literal("rejected") }),
    z.object({ ...failure, status: z.literal("error") }),
  ]);

  return outcome;
};

export const validatedCommandOutcomeSchema = createCommandOutcomeSchema(z.json());
