import type { NavigationTarget } from "@pstdio/sdk/extensions";
import {
  commandSourceSchema,
  extensionResourceRefSchema,
  localizableStringSchema,
  serializableJsonObjectSchema,
} from "pstdio-api-contracts";
import { z } from "zod";

export const localRefSchema = <Kind extends string>(kind: Kind) =>
  z
    .object({
      kind: z.literal(kind),
      id: z.string().min(1),
      extensionId: z.string().min(1).optional(),
    })
    .strict();

const pageTarget: z.ZodType<Extract<NavigationTarget, { kind: "page" }>> = z.lazy(() =>
  z
    .object({
      kind: z.literal("page"),
      page: localRefSchema("page"),
      resource: extensionResourceRefSchema.optional(),
      open: z.enum(["preview", "pin"]).optional(),
      section: z
        .object({
          anchors: z.array(
            z
              .object({ id: z.string(), heading: z.string(), occurrence: z.number().int().nonnegative().optional() })
              .strict(),
          ),
        })
        .strict()
        .optional(),
      parent: pageTarget.optional(),
    })
    .strict(),
);
const panelTarget = z
  .object({
    kind: z.literal("panel"),
    panel: z.discriminatedUnion("kind", [
      localRefSchema("placement"),
      z.object({ kind: z.literal("page-slot"), page: localRefSchema("page"), id: z.string().min(1) }).strict(),
    ]),
    resource: extensionResourceRefSchema.optional(),
    open: z.enum(["preview", "pin"]).optional(),
  })
  .strict();

// Select the branch before parsing so a malformed target names its actual field.
export const navigationDeclarationSchema: z.ZodType<NavigationTarget> = z
  .unknown()
  .superRefine((value, ctx) => {
    const kind = typeof value === "object" && value !== null && "kind" in value ? value.kind : undefined;
    const schema = {
      page: pageTarget,
      panel: panelTarget,
      command: z
        .object({
          kind: z.literal("command"),
          target: z
            .object({ command: localRefSchema("command"), params: serializableJsonObjectSchema.optional() })
            .strict(),
        })
        .strict(),
      href: z.object({ kind: z.literal("href"), href: z.string() }).strict(),
      compound: z
        .object({
          kind: z.literal("compound"),
          targets: z
            .array(
              z.unknown().superRefine((target, inner) => {
                const result = navigationDeclarationSchema.safeParse(target);
                if (!result.success)
                  result.error.issues.forEach((issue) => {
                    inner.addIssue({ ...issue });
                  });
                else if (result.data.kind !== "page" && result.data.kind !== "panel")
                  inner.addIssue({ code: "custom", message: "a page or panel target" });
              }),
            )
            .min(1),
        })
        .strict(),
    };
    if (typeof kind !== "string" || !(kind in schema)) {
      ctx.addIssue({ code: "custom", path: ["kind"], message: "page, panel, command, href, or compound" });
      return;
    }
    const result = schema[kind as keyof typeof schema].safeParse(value);
    if (!result.success)
      result.error.issues.forEach((issue) => {
        ctx.addIssue({ ...issue });
      });
  })
  .transform((value) => value as NavigationTarget);

export const navigationItemDeclarationSchema = z
  .object({
    id: z.string(),
    ref: localRefSchema("navigation-item"),
    owner: z.union([localRefSchema("mode"), localRefSchema("page")]),
    slot: z.enum(["header", "content", "footer"]).optional(),
    label: localizableStringSchema,
    icon: z.string().optional(),
    group: z.string().optional(),
    when: z
      .object({
        mode: z.union([localRefSchema("mode"), z.array(localRefSchema("mode"))]).optional(),
        view: z.union([localRefSchema("view"), z.array(localRefSchema("view"))]).optional(),
        source: z.array(commandSourceSchema).optional(),
        resourceType: z.array(localRefSchema("resource-kind")).optional(),
        metadata: serializableJsonObjectSchema.optional(),
      })
      .strict()
      .optional(),
    action: navigationDeclarationSchema,
  })
  .strict();
