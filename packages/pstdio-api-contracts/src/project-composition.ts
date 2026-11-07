import { z } from "zod";
import { navigationTargetSchema } from "./extensions/navigation-target-metadata";
import { extensionResourceRefSchema } from "./extensions/resource-ref";

export const resourceOpeningsRequestSchema = z
  .object({ resources: z.array(extensionResourceRefSchema).max(100) })
  .strict();
export const resourceOpeningsResponseSchema = z.array(
  z.object({
    resource: extensionResourceRefSchema,
    target: navigationTargetSchema.optional(),
  }),
);

const qualifiedRef = <Kind extends string>(kind: Kind) =>
  z
    .object({
      kind: z.literal(kind),
      extensionId: z.string().min(1),
      id: z.string().min(1),
    })
    .strict();

/** A resource opener selects an ordinary public page or a command returning a navigation target. */
export const resourceOpenerSchema = z
  .object({
    resourceKind: qualifiedRef("resource-kind"),
    opener: z.discriminatedUnion("kind", [qualifiedRef("page"), qualifiedRef("command")]),
    relatedOpenings: qualifiedRef("command").optional(),
  })
  .strict();

export const projectCompositionSchema = z
  .object({
    defaultPage: qualifiedRef("page").nullable().optional(),
    resourceOpeners: z.array(resourceOpenerSchema).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const kinds = new Set<string>();
    for (const [index, binding] of value.resourceOpeners.entries()) {
      const key = JSON.stringify([binding.resourceKind.extensionId, binding.resourceKind.id]);
      if (kinds.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["resourceOpeners", index],
          message: "Choose one opener per resource kind",
        });
      kinds.add(key);
    }
  });

export type ProjectComposition = z.output<typeof projectCompositionSchema>;
export type ProjectCompositionInput = z.input<typeof projectCompositionSchema>;
export type ResourceOpener = z.infer<typeof resourceOpenerSchema>;
