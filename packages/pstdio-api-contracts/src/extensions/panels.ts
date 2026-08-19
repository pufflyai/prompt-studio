import { z } from "zod";
import { workbenchModePanels } from "../extension-kernel/workbench-targets";
import {
  extensionPlacementSchema,
  extensionWebviewContributionSchema,
  extensionWhenExpressionSchema,
  jsonObjectSchema,
  localizableStringSchema,
  workbenchExtensionWebviewSchema,
} from "./common";
import { workbenchRegionSchema, workbenchTreeTargetSchema } from "./targets";

const hasSinglePanelBody = (value: { webview?: unknown; renderer?: unknown }) =>
  [value.webview, value.renderer].filter(Boolean).length === 1;

const singlePanelBodyMessage = "Extension panels must declare exactly one body: webview or renderer";

const hostTreeDefaultSchema = z.enum(["default", "none"]);
const panelBodySchema = {
  webview: extensionWebviewContributionSchema.optional(),
  renderer: z
    .object({
      kind: z.enum(["tree", "file", "controls", "dataTable", "kanban"]),
      id: z.string(),
    })
    .optional(),
};
const extensionPanelMenuRecordSchema = z
  .object({
    id: z.string(),
    extensionId: z.string(),
    ownerPanelId: z.string(),
    title: localizableStringSchema,
    side: z.enum(["left", "right"]),
    group: z.string().optional(),
    placement: extensionPlacementSchema.optional(),
    hostTreeHeader: hostTreeDefaultSchema.optional(),
    hostTreeFooter: hostTreeDefaultSchema.optional(),
    ...panelBodySchema,
  })
  .refine(hasSinglePanelBody, { message: singlePanelBodyMessage });
const workbenchExtensionPanelMenuRecordSchema = extensionPanelMenuRecordSchema
  .safeExtend({ webview: workbenchExtensionWebviewSchema.optional() })
  .refine(hasSinglePanelBody, { message: singlePanelBodyMessage });

const extensionPanelRecordBaseSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  region: workbenchRegionSchema,
  closable: z.boolean(),
  group: z.string().optional(),
  placement: extensionPlacementSchema.optional(),
  resourceKind: z.string().optional(),
  eligibleLocations: z.object({ resourceKinds: z.array(z.string()).optional() }).optional(),
  panelMenus: z.array(extensionPanelMenuRecordSchema).optional(),
  ...panelBodySchema,
});

export const extensionPanelRecordSchema = extensionPanelRecordBaseSchema.refine(hasSinglePanelBody, {
  message: singlePanelBodyMessage,
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
  z.object({ kind: z.literal("panel"), panelId: z.string() }),
  z.object({ kind: z.literal("route"), route: z.string() }),
  z.object({ kind: z.literal("href"), href: z.string() }),
]);

export const extensionActivityItemRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string(),
  modes: z.array(z.string()),
  placement: extensionPlacementSchema.optional(),
  commandId: z.string(),
  params: jsonObjectSchema.optional(),
});

export const extensionTreeItemContributionSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  target: workbenchTreeTargetSchema,
  label: localizableStringSchema,
  group: z.string().nullable().optional(),
  placement: extensionPlacementSchema.optional(),
  icon: z.string().optional(),
  action: extensionTreeItemActionSchema,
  when: extensionWhenExpressionSchema.optional(),
});

const modeTargetContributionRecordSchema = z
  .object({
    panel: z.string().optional(),
    resource: z.string().optional(),
    region: workbenchRegionSchema.optional(),
    title: localizableStringSchema.optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => value.panel || value.resource, {
    message: "Mode layout entries must declare a panel or resource",
  });

export const modeLayoutContributionRecordSchema = z.object({
  panels: z.array(z.enum(workbenchModePanels)).optional(),
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

export const workbenchExtensionPanelRecordSchema = extensionPanelRecordBaseSchema
  .extend({
    extensionInstanceId: z.string().optional(),
    installedExtensionId: z.string().optional(),
    installName: z.string().optional(),
    webview: workbenchExtensionWebviewSchema.optional(),
    panelMenus: z.array(workbenchExtensionPanelMenuRecordSchema).optional(),
  })
  .refine(hasSinglePanelBody, {
    message: singlePanelBodyMessage,
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

export type ExtensionPanelRecord = z.infer<typeof extensionPanelRecordSchema>;
export type ExtensionRouteRecord = z.infer<typeof extensionRouteRecordSchema>;
export type ExtensionNavigationRecord = z.infer<typeof extensionNavigationRecordSchema>;
export type ExtensionTreeItemContribution = z.infer<typeof extensionTreeItemContributionSchema>;
export type ExtensionActivityItemRecord = z.infer<typeof extensionActivityItemRecordSchema>;
export type ModeLayoutContributionRecord = z.infer<typeof modeLayoutContributionRecordSchema>;
export type ExtensionModeRecord = z.infer<typeof extensionModeRecordSchema>;
export type WorkbenchExtensionPanelRecord = z.infer<typeof workbenchExtensionPanelRecordSchema>;
export type WorkbenchExtensionRouteRecord = z.infer<typeof workbenchExtensionRouteRecordSchema>;
