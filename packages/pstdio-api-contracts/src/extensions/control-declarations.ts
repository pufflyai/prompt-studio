import { z } from "zod";
import type { ControlParam, ControlsQueryResult } from "../extension-kernel";
import { extensionResourceRefSchema } from "./execute";

const base = { id: z.string(), name: z.string(), description: z.string().optional(), readOnly: z.boolean().optional() };
const numeric = { min: z.number().optional(), max: z.number().optional(), step: z.number().optional() };
const vector = z.strictObject({ x: z.number(), y: z.number() });
const range = z.tuple([z.number(), z.number()]);
const selectionValue = z.union([z.string(), z.array(z.string())]);
const selectionOption = z.strictObject({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});
const selection = {
  placeholder: z.string().optional(),
  searchable: z.boolean().optional(),
  searchPlaceholder: z.string().optional(),
  emptyText: z.string().optional(),
  disabled: z.boolean().optional(),
};
const image = z.strictObject({ src: z.string(), alt: z.string() });
const primitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const readOnlyContent = z.union([
  primitive,
  z.array(primitive),
  image.extend({ type: z.literal("image") }),
  z.strictObject({ type: z.literal("image-gallery"), images: z.array(image) }),
]);

export const controlValueSchema = z.union([primitive, z.array(z.string()), range, vector]);
export const controlValuesSchema = z.record(z.string(), controlValueSchema);
export const controlParamSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...base, ...numeric, type: z.literal("number"), defaultValue: z.number() }),
  z.strictObject({ ...base, type: z.literal("boolean"), defaultValue: z.boolean() }),
  z.strictObject({ ...base, type: z.literal("text"), defaultValue: z.string(), singleLine: z.boolean().optional() }),
  z.strictObject({
    ...base,
    type: z.literal("markdown"),
    defaultValue: z.string(),
    placeholder: z.string().optional(),
  }),
  z.strictObject({
    ...base,
    ...selection,
    type: z.literal("selection"),
    defaultValue: selectionValue,
    options: z.array(selectionOption),
    multiSelect: z.boolean().optional(),
    clearable: z.boolean().optional(),
    group: z
      .strictObject({
        id: z.string(),
        name: z.string(),
        defaultValue: z.string(),
        options: z.array(selectionOption),
        ...selection,
      })
      .optional(),
  }),
  z.strictObject({
    ...base,
    type: z.literal("date"),
    defaultValue: z.string(),
    min: z.string().optional(),
    max: z.string().optional(),
  }),
  z.strictObject({ ...base, type: z.literal("color"), defaultValue: z.string() }),
  z.strictObject({ ...base, type: z.literal("readOnly"), value: readOnlyContent }),
  z.strictObject({
    ...base,
    type: z.literal("resource"),
    defaultValue: selectionValue,
    options: z.array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        href: z.string().optional(),
        ref: extensionResourceRefSchema.optional(),
        copyText: z.string().optional(),
      }),
    ),
    multiSelect: z.boolean().optional(),
    editable: z.boolean().optional(),
    placeholder: z.string().optional(),
    emptyText: z.string().optional(),
  }),
  z.strictObject({
    ...base,
    ...numeric,
    type: z.literal("range"),
    defaultValue: range,
    min: z.number(),
    max: z.number(),
    unit: z.string().optional(),
    markerCount: z.number().optional(),
  }),
  z.strictObject({
    ...base,
    type: z.literal("segmented"),
    defaultValue: z.string(),
    variant: z.enum(["default", "dots"]).optional(),
    options: z.array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        icon: z.string().optional(),
        indicatorColor: z.string().optional(),
      }),
    ),
  }),
  z.strictObject({
    ...base,
    type: z.literal("actions"),
    defaultValue: z.string().optional(),
    options: z.array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        icon: z.string().optional(),
        disabled: z.boolean().optional(),
      }),
    ),
  }),
  z.strictObject({
    ...base,
    type: z.literal("anchorGrid"),
    defaultValue: z.enum([
      "top-left",
      "top",
      "top-right",
      "left",
      "center",
      "right",
      "bottom-left",
      "bottom",
      "bottom-right",
    ]),
  }),
  z.strictObject({
    ...base,
    ...numeric,
    type: z.literal("vector"),
    defaultValue: vector,
    coordinateMode: z.enum(["cartesian", "screen"]).optional(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
  }),
]) satisfies z.ZodType<ControlParam>;

export const controlGroupSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  params: z.array(controlParamSchema),
  collapsible: z.boolean().optional(),
  defaultCollapsed: z.boolean().optional(),
});
export const controlsQueryResultSchema = z.strictObject({
  params: z.array(controlParamSchema).optional(),
  groups: z.array(controlGroupSchema).optional(),
  values: controlValuesSchema.optional(),
  readOnly: z.boolean().optional(),
}) satisfies z.ZodType<ControlsQueryResult>;
