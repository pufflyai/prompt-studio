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
import { extensionModeCompositionRecordSchema, extensionPanelPlacementSchema } from "./composition";
import { extensionResourceRefSchema } from "./execute";
import { workbenchTreeTargetSchema } from "./targets";

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
  path: z.string().optional(),
  icon: z.string().optional(),
  show: z.union([extensionPanelPlacementSchema, z.array(extensionPanelPlacementSchema).min(1)]).optional(),
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

const extensionTreeItemActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("command"),
    commandId: z.string(),
    args: jsonObjectSchema.optional(),
  }),
  z.object({ kind: z.literal("view"), viewId: z.string() }),
  z.object({ kind: z.literal("href"), href: z.string() }),
  z.object({ kind: z.literal("resource"), resource: extensionResourceRefSchema }),
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

export const extensionModeRecordSchema = z
  .object({
    id: z.string(),
    extensionId: z.string(),
    modeId: z.string(),
    label: localizableStringSchema,
    icon: z.string().optional(),
    panelRegions: z.array(z.enum(workbenchModePanels)).optional(),
  })
  .extend(extensionModeCompositionRecordSchema.partial().shape);

export const extensionStatusItemRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  when: extensionWhenExpressionSchema.optional(),
  webview: workbenchExtensionWebviewSchema.optional(),
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
export type ExtensionTreeItemContribution = z.infer<typeof extensionTreeItemContributionSchema>;
export type ExtensionActivityItemRecord = z.infer<typeof extensionActivityItemRecordSchema>;
export type ExtensionModeRecord = z.infer<typeof extensionModeRecordSchema>;
export type WorkbenchExtensionPanelRecord = z.infer<typeof workbenchExtensionPanelRecordSchema>;
export type WorkbenchExtensionRouteRecord = z.infer<typeof workbenchExtensionRouteRecordSchema>;
