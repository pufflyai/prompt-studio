import { serializableJsonObjectSchema as jsonObjectSchema } from "pstdio-api-contracts";
import { z } from "zod";

const id = z.string().min(1);
const session = { sessionId: id };
const changes = z.array(z.object({ path: z.array(z.string()), value: z.json() }));
const edit = { ...session, sequence: z.number().int().positive(), changes };

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
  z.object({ ...edit, operation: z.literal("commit") }),
  z.object({ ...edit, operation: z.literal("preview") }),
  z.object({ ...session, operation: z.literal("cancel") }),
  z.object({ ...session, operation: z.literal("close") }),
  z.object({ ...session, operation: z.literal("save") }),
  z.object({
    ...session,
    operation: z.literal("refresh"),
    value: jsonObjectSchema,
    expectedVersion: z.number().int().nonnegative(),
  }),
]);
