import { z } from "zod";
import {
  extensionPlacementSchema,
  extensionWebviewContributionSchema,
  extensionWhenExpressionSchema,
  jsonObjectSchema,
  localizableStringSchema,
  workbenchExtensionWebviewSchema,
} from "./common";
import { workbenchModeLayoutTargetSchema, workbenchTreeTargetSchema, workbenchViewTargetSchema } from "./targets";

const hasSingleViewBody = (value: {
  webview?: unknown;
  treeRendererId?: unknown;
  fileRendererId?: unknown;
  controlsRendererId?: unknown;
}) =>
  [value.webview, value.treeRendererId, value.fileRendererId, value.controlsRendererId].filter(Boolean).length === 1;

const singleViewBodyMessage =
  "Extension views must declare exactly one body: webview, treeRendererId, fileRendererId, or controlsRendererId";

const hostTreeDefaultSchema = z.enum(["default", "none"]);

const extensionViewRecordBaseSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  slotId: z.string(),
  target: workbenchViewTargetSchema.optional(),
  title: localizableStringSchema,
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  /** When set, the host opens this view's webview for resources of this kind. */
  resourceKind: z.string().optional(),
  /** `modal` mounts the view as an overlay dialog (e.g. data-renderer create flows). */
  surface: z.enum(["panel", "modal"]).optional(),
  webview: extensionWebviewContributionSchema.optional(),
  treeRendererId: z.string().optional(),
  fileRendererId: z.string().optional(),
  controlsRendererId: z.string().optional(),
  hostTreeHeader: hostTreeDefaultSchema.optional(),
  hostTreeFooter: hostTreeDefaultSchema.optional(),
});

export const extensionViewRecordSchema = extensionViewRecordBaseSchema.refine(hasSingleViewBody, {
  message: singleViewBodyMessage,
});

export const extensionRouteRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  path: z.string(),
  label: localizableStringSchema,
  webview: extensionWebviewContributionSchema,
});

export const extensionNavigationRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  slotId: z.string(),
  label: localizableStringSchema,
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  route: z.string().optional(),
  href: z.string().optional(),
  commandId: z.string().optional(),
  params: jsonObjectSchema.optional(),
  icon: z.string().optional(),
  when: extensionWhenExpressionSchema.optional(),
});

const extensionTreeItemActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("command"),
    commandId: z.string(),
    args: jsonObjectSchema.optional(),
  }),
  z.object({ kind: z.literal("dataRenderer"), dataRendererId: z.string() }),
  z.object({ kind: z.literal("route"), route: z.string() }),
  z.object({ kind: z.literal("href"), href: z.string() }),
]);

export const extensionTreeItemContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  target: workbenchTreeTargetSchema,
  label: localizableStringSchema,
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  action: extensionTreeItemActionSchema,
  when: extensionWhenExpressionSchema.optional(),
});

const modeTargetContributionRecordSchema = z
  .object({
    target: workbenchModeLayoutTargetSchema,
    view: z.string().optional(),
    resource: z.string().optional(),
    widget: z.string().optional(),
    title: localizableStringSchema.optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => value.view || value.resource, {
    message: "Mode layout entries must declare a view or resource",
  });

export const modeLayoutContributionRecordSchema = z.object({
  reset: z.union([z.boolean(), z.array(workbenchModeLayoutTargetSchema)]).optional(),
  open: z.array(modeTargetContributionRecordSchema).optional(),
});

export const extensionModeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  modeId: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  resourceKind: z.string().optional(),
  layout: modeLayoutContributionRecordSchema.optional(),
});

export const workbenchExtensionViewRecordSchema = extensionViewRecordBaseSchema
  .extend({
    extensionInstanceId: z.string().optional(),
    installedExtensionId: z.string().optional(),
    installName: z.string().optional(),
    webview: workbenchExtensionWebviewSchema.optional(),
  })
  .refine(hasSingleViewBody, {
    message: singleViewBodyMessage,
  });

export const workbenchExtensionRouteRecordSchema = extensionRouteRecordSchema.extend({
  extensionInstanceId: z.string().optional(),
  installedExtensionId: z.string().optional(),
  installName: z.string().optional(),
  webview: workbenchExtensionWebviewSchema,
});

export const extensionViewLikeSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
});

export type ExtensionViewRecord = z.infer<typeof extensionViewRecordSchema>;
export type ExtensionRouteRecord = z.infer<typeof extensionRouteRecordSchema>;
export type ExtensionNavigationRecord = z.infer<typeof extensionNavigationRecordSchema>;
export type ExtensionTreeItemContribution = z.infer<typeof extensionTreeItemContributionSchema>;
export type ModeLayoutContributionRecord = z.infer<typeof modeLayoutContributionRecordSchema>;
export type ExtensionModeRecord = z.infer<typeof extensionModeRecordSchema>;
export type WorkbenchExtensionViewRecord = z.infer<typeof workbenchExtensionViewRecordSchema>;
export type WorkbenchExtensionRouteRecord = z.infer<typeof workbenchExtensionRouteRecordSchema>;
