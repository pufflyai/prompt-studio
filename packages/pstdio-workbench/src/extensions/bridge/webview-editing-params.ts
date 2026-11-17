import { serializableJsonObjectSchema as jsonObjectSchema } from "pstdio-api-contracts";
import type { RendererEventReference } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";

const id = z.string().min(1);
const session = { sessionId: id };
const changes = z.array(z.object({ path: z.array(z.string()), value: z.json() }));
const edit = { ...session, sequence: z.number().int().positive(), changes };
const command = z.object({ commandId: id, params: jsonObjectSchema.optional() }).strict();
const eventReference: z.ZodType<RendererEventReference> = z.union([
  z.templateLiteral([z.string(), ".", z.string()]),
  z.object({ kind: z.literal("event"), id, extensionId: id.optional() }),
]);

export const webviewEditingResultSchema = z.union([
  z.object({ value: jsonObjectSchema, sourceIds: z.array(id).optional() }),
  z.object({ changes, sourceIds: z.array(id).optional() }),
]);
export const webviewEditingLoadSchema = z.object({
  value: jsonObjectSchema,
  sources: z
    .array(
      z.object({
        id,
        read: command,
        dependsOn: z.array(eventReference),
        dependency: z
          .object({
            recordId: id.optional(),
            recordIds: z.array(id).max(128).optional(),
            resourceId: id.optional(),
            resourceKey: id.optional(),
            fields: z.array(id).optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(128),
});

export const webviewEditingSessionParamsSchema = z.discriminatedUnion("operation", [
  z.object({
    ...session,
    operation: z.literal("open"),
    key: id,
    initial: jsonObjectSchema,
    save: z
      .object({
        commandId: id,
        params: jsonObjectSchema.optional(),
      })
      .strict(),
  }),
  z.object({
    ...session,
    operation: z.literal("open-command"),
    key: id,
    read: command,
    command,
    dependsOn: z.array(eventReference),
  }),
  z.object({
    ...edit,
    operation: z.literal("execute"),
    params: jsonObjectSchema,
    channel: z.enum(["document", "presentation"]).optional(),
  }),
  z.object({ ...edit, operation: z.literal("commit") }),
  z.object({ ...edit, operation: z.literal("preview") }),
  z.object({ ...session, operation: z.literal("cancel"), sequence: z.number().int().positive().optional() }),
  z.object({ ...session, operation: z.literal("close") }),
  z.object({ ...session, operation: z.literal("save") }),
  z.object({
    ...session,
    operation: z.literal("refresh"),
    value: jsonObjectSchema,
    expectedVersion: z.number().int().nonnegative(),
  }),
]);
