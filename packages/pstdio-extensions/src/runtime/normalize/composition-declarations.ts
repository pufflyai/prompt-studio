import { extensionPanelRegions } from "@pstdio/sdk/extensions";
import { localizableStringSchema, regionSettingsSchema } from "pstdio-api-contracts";
import { z } from "zod";
import { localRefSchema, navigationDeclarationSchema } from "./navigation-declaration";

export const callbackSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
  "a callback function",
);
const region = z.enum(extensionPanelRegions);
const presentation = {
  mountStrategy: z.enum(["active", "keep-mounted"]).optional(),
  hiddenByDefault: z.boolean().optional(),
  headerBorderBottom: z.boolean().optional(),
  tab: z
    .object({
      query: callbackSchema,
      refreshEvents: z.array(z.union([z.string().regex(/\./), localRefSchema("event")])).optional(),
    })
    .strict()
    .optional(),
};
const resource = z.object({ kinds: z.array(localRefSchema("resource-kind")).min(1) }).strict();
const binding = resource.extend({
  view: localRefSchema("view"),
  cardinality: z.enum(["one", "many"]),
  add: navigationDeclarationSchema.optional(),
});
const item = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("view"), view: localRefSchema("view"), presence: z.enum(["fixed", "open", "closed"]) })
    .strict(),
  z.object({ kind: z.literal("binding"), binding }).strict(),
]);
const slot = z
  .object({
    id: z.string(),
    region,
    item,
    order: z.number().optional(),
    openOn: z.literal("page-resource").optional(),
    ...presentation,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.openOn && value.item.kind !== "binding")
      ctx.addIssue({ code: "custom", path: ["openOn"], message: "a resource-binding item for page-resource" });
  });
export const pageDeclarationSchema = z
  .object({
    id: z.string(),
    ref: localRefSchema("page"),
    title: localizableStringSchema,
    icon: z.string().optional(),
    path: z.string(),
    mode: localRefSchema("mode"),
    parent: localRefSchema("page").optional(),
    resource: resource.optional(),
    main: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("view"),
          view: localRefSchema("view"),
          cardinality: z.enum(["one", "many"]),
          ...presentation,
        })
        .strict(),
      z.object({ kind: z.literal("panels"), empty: localRefSchema("view") }).strict(),
    ]),
    slots: z.array(slot),
    panels: z.record(z.string(), z.unknown()),
  })
  .strict();
export const placementDeclarationSchema = z
  .object({
    id: z.string(),
    ref: localRefSchema("placement"),
    mode: localRefSchema("mode"),
    region,
    item,
    order: z.number().optional(),
    movableTo: z.array(region).optional(),
    ...presentation,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.movableTo && !value.movableTo.includes(value.region))
      ctx.addIssue({ code: "custom", path: ["movableTo"], message: "an array including the initial region" });
  });
export const modeDeclarationSchema = z
  .object({
    id: z.string(),
    ref: localRefSchema("mode"),
    label: localizableStringSchema,
    icon: z.string().optional(),
    regions: z.array(region),
    floatingPanels: z.enum(["visible", "hidden"]).optional(),
    defaultTheme: localRefSchema("theme").optional(),
    chrome: z
      .object(
        Object.fromEntries(
          ["nav", "sidenav", "activity", "status"].map((key) => [
            key,
            z.union([z.literal(false), localRefSchema("view")]).optional(),
          ]),
        ),
      )
      .strict()
      .optional(),
    regionSettings: z.record(z.string(), regionSettingsSchema.strict()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value.regionSettings ?? {})) {
      if (key !== "sidenav" && !value.regions.includes(key as z.infer<typeof region>))
        ctx.addIssue({ code: "custom", path: ["regionSettings", key], message: "a declared region or sidenav" });
    }
  });
