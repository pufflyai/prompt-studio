import { z } from "zod";
import { serializableJsonObjectSchema } from "./common";

export const contributionRefSchema = <Kind extends string>(kind: Kind) =>
  z.object({ extensionId: z.string(), kind: z.literal(kind), id: z.string() });

export const pageRefSchema = contributionRefSchema("page");
export const placementRefSchema = contributionRefSchema("placement");
export const modeRefSchema = contributionRefSchema("mode");
export const viewRefSchema = contributionRefSchema("view");
export const resourceKindRefSchema = contributionRefSchema("resource-kind");

export const pageSlotRefSchema = z.object({
  kind: z.literal("page-slot"),
  page: pageRefSchema,
  id: z.string(),
});

export const panelRefSchema = z.union([placementRefSchema, pageSlotRefSchema]);

export const commandTargetSchema = z.object({
  command: contributionRefSchema("command"),
  params: serializableJsonObjectSchema.optional(),
});
