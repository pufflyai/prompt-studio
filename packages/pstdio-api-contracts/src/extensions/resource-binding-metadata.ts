import { z } from "zod";
import { navigationTargetSchema } from "./navigation-target-metadata";
import { placementPresenceSchema } from "./placement-metadata";
import { resourceKindRefSchema, viewRefSchema } from "./workbench-refs-metadata";

export const resourceConstraintSchema = z.object({ kinds: z.array(resourceKindRefSchema).min(1) }).strict();
export const resourceBindingSchema = resourceConstraintSchema.extend({
  view: viewRefSchema,
  cardinality: z.enum(["one", "many"]),
  add: navigationTargetSchema.optional(),
});
export const placementItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("view"), view: viewRefSchema, presence: placementPresenceSchema }).strict(),
  z.object({ kind: z.literal("binding"), binding: resourceBindingSchema }).strict(),
]);
