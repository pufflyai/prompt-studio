import { z } from "zod";
import { extensionPanelRegions } from "../extension-kernel/types/composition";
import {
  extensionCommandPaletteContributionSchema,
  extensionCommandRecordSchema,
  extensionMenuContributionSchema,
  workbenchExtensionAutomationRecordSchema,
} from "./commands";
import {
  extensionDiagnosticSchema,
  extensionRecordSchema,
  jsonObjectSchema,
  localizableStringSchema,
  workbenchExtensionWebviewSchema,
} from "./common";
import { workbenchExtensionConnectionRecordSchema } from "./connections";
import { extensionControlsRendererRecordSchema } from "./controls-renderer";
import { extensionDataTableRendererRecordSchema } from "./data-table-renderer";
import { extensionCommandPaletteResourceRecordSchema, extensionKanbanRendererRecordSchema } from "./kanban-renderer";
import { extensionKeybindingRecordSchema } from "./keybindings";
import { navigationTargetSchema } from "./navigation-target-metadata";
import { workbenchExtensionPageRecordSchema } from "./page-metadata";
import {
  placementPresenceSchema,
  regionSettingsSchema,
  workbenchPlacementPresentationSchema,
} from "./placement-metadata";
import { extensionFileRendererRecordSchema, extensionTreeRendererRecordSchema } from "./renderers";
import { extensionSettingDefinitionRecordSchema, extensionSettingsSectionRecordSchema } from "./settings";

const contributionRefSchema = <Kind extends string>(kind: Kind) =>
  z.object({ extensionId: z.string(), kind: z.literal(kind), id: z.string() });

const commandRefSchema = contributionRefSchema("command");
const modeRefSchema = contributionRefSchema("mode");
const pageRefSchema = contributionRefSchema("page");
const resourceKindRefSchema = contributionRefSchema("resource-kind");
const settingsSectionRefSchema = contributionRefSchema("settings-section");
const statusRefSchema = contributionRefSchema("status");
const viewRefSchema = contributionRefSchema("view");

const normalizedWhenSchema = z.object({
  mode: z.union([modeRefSchema, z.array(modeRefSchema)]).optional(),
  source: z.array(z.enum(["cli", "dashboard", "api", "schedule", "event", "automation", "command-panel"])).optional(),
  view: z.union([viewRefSchema, z.array(viewRefSchema)]).optional(),
  resourceType: z.array(resourceKindRefSchema).optional(),
  metadata: jsonObjectSchema.optional(),
});

const rendererBaseOmissions = {
  id: true,
  extensionId: true,
  title: true,
  icon: true,
  resourceKind: true,
} as const;

const commandActionSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  destructive: z.boolean().optional(),
  command: commandRefSchema,
});

const kanbanCreateRowSchema = z.object({
  command: commandRefSchema,
  title: localizableStringSchema.optional(),
  submitLabel: localizableStringSchema.optional(),
  columnParam: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  attributesParam: z.string().optional(),
  attachments: z.object({ command: commandRefSchema, resourceParam: z.string(), fileParam: z.string() }).optional(),
  labels: z
    .object({
      cancel: localizableStringSchema.optional(),
      properties: localizableStringSchema.optional(),
      submitError: localizableStringSchema.optional(),
      removeFile: localizableStringSchema.optional(),
    })
    .optional(),
});

const webviewBodySchema = z.object({ kind: z.literal("webview"), webview: workbenchExtensionWebviewSchema });
const treeBodySchema = extensionTreeRendererRecordSchema
  .omit(rendererBaseOmissions)
  .extend({ kind: z.literal("tree") });
const fileBodySchema = extensionFileRendererRecordSchema
  .omit(rendererBaseOmissions)
  .extend({ kind: z.literal("file") });
const controlsBodySchema = extensionControlsRendererRecordSchema
  .omit(rendererBaseOmissions)
  .extend({ kind: z.literal("controls") });
const kanbanBodySchema = extensionKanbanRendererRecordSchema
  .omit({ ...rendererBaseOmissions, createRow: true, rowActions: true })
  .extend({
    kind: z.literal("kanban"),
    createRow: kanbanCreateRowSchema.optional(),
    rowActions: z.array(commandActionSchema).optional(),
  });
const dataTableBodySchema = extensionDataTableRendererRecordSchema
  .omit({ ...rendererBaseOmissions, selectionActions: true, rowActions: true })
  .extend({
    kind: z.literal("dataTable"),
    selectionActions: z.array(commandActionSchema).optional(),
    rowActions: z.array(commandActionSchema).optional(),
  });

export const workbenchExtensionViewBodySchema = z.discriminatedUnion("kind", [
  webviewBodySchema,
  treeBodySchema,
  fileBodySchema,
  controlsBodySchema,
  kanbanBodySchema,
  dataTableBodySchema,
]);

export const workbenchExtensionViewRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  icon: z.string().optional(),
  body: workbenchExtensionViewBodySchema,
});

const workbenchExtensionModeRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  regions: z.array(z.enum(extensionPanelRegions)),
  regionSettings: z.partialRecord(z.enum(extensionPanelRegions), regionSettingsSchema).optional(),
});

const workbenchExtensionPlacementRecordSchema = workbenchPlacementPresentationSchema.extend({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  mode: modeRefSchema,
  item: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("view"), view: viewRefSchema, presence: placementPresenceSchema }),
    z.object({
      kind: z.literal("binding"),
      resourceKind: z.union([resourceKindRefSchema, z.array(resourceKindRefSchema)]),
      view: viewRefSchema,
      cardinality: z.enum(["one", "many"]),
      add: navigationTargetSchema.optional(),
    }),
  ]),
  region: z.enum(extensionPanelRegions),
  order: z.number().optional(),
  movableTo: z.array(z.enum(extensionPanelRegions)).optional(),
});

const workbenchExtensionViewMenuRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  owner: viewRefSchema,
  view: viewRefSchema,
  side: z.enum(["left", "right"]),
  group: z.string().optional(),
  placement: z.enum(["first", "default", "last"]).optional(),
  hostTreeHeader: z.enum(["default", "none"]).optional(),
  hostTreeFooter: z.enum(["default", "none"]).optional(),
});

const workbenchExtensionNavigationItemRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  owner: z.union([modeRefSchema, pageRefSchema]),
  slot: z.enum(["header", "content", "footer"]),
  label: localizableStringSchema,
  icon: z.string().optional(),
  group: z.string().optional(),
  when: normalizedWhenSchema.optional(),
  action: navigationTargetSchema,
});

const workbenchExtensionNavigationTreeRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  owner: z.union([modeRefSchema, pageRefSchema]),
  slot: z.enum(["header", "content", "footer"]),
  view: viewRefSchema,
});

const workbenchExtensionResourceKindRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  label: localizableStringSchema.optional(),
  icon: z.string().optional(),
  menuSlots: z
    .array(
      z.object({
        id: z.string(),
        placement: z.enum(["header-primary", "header-overflow", "context-menu"]),
        label: localizableStringSchema.optional(),
        access: z.enum(["owner", "public"]),
        order: z.number().optional(),
      }),
    )
    .optional(),
});

const workbenchExtensionSettingsPanelRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  view: viewRefSchema,
  slot: z.object({ id: z.string() }),
  section: settingsSectionRefSchema.optional(),
});

const workbenchExtensionStatusBarItemRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  view: viewRefSchema,
  slot: z.object({ id: z.string() }),
  order: z.number().optional(),
  when: normalizedWhenSchema.optional(),
});

const workbenchExtensionStatusRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  title: localizableStringSchema,
  actions: z
    .array(z.object({ id: z.string(), label: localizableStringSchema, icon: z.string().optional() }))
    .optional(),
  queryHandlerId: z.string(),
  saveHandlerId: z.string().optional(),
});

export const workbenchExtensionMetadataSchema = z.object({
  extensions: z.array(extensionRecordSchema),
  commands: z.array(extensionCommandRecordSchema),
  menuContributions: z.array(extensionMenuContributionSchema),
  commandPaletteContributions: z.array(extensionCommandPaletteContributionSchema).optional(),
  modes: z.array(workbenchExtensionModeRecordSchema),
  pages: z.array(workbenchExtensionPageRecordSchema),
  views: z.array(workbenchExtensionViewRecordSchema),
  viewMenus: z.array(workbenchExtensionViewMenuRecordSchema),
  placements: z.array(workbenchExtensionPlacementRecordSchema),
  resourceKinds: z.array(workbenchExtensionResourceKindRecordSchema),
  resourceHierarchyProviders: z
    .array(z.object({ id: z.string(), extensionId: z.string(), resourceKind: resourceKindRefSchema }))
    .optional(),
  navigationItems: z.array(workbenchExtensionNavigationItemRecordSchema),
  navigationTrees: z.array(workbenchExtensionNavigationTreeRecordSchema),
  statusBarItems: z.array(workbenchExtensionStatusBarItemRecordSchema),
  statuses: z.array(workbenchExtensionStatusRecordSchema),
  activityItems: z
    .array(
      z.object({
        id: z.string(),
        extensionId: z.string(),
        title: localizableStringSchema,
        icon: z.string(),
        modes: z.array(modeRefSchema),
        placement: z.enum(["first", "default", "last"]).optional(),
        command: commandRefSchema,
        params: jsonObjectSchema.optional(),
      }),
    )
    .optional(),
  settingsSections: z.array(extensionSettingsSectionRecordSchema).optional(),
  settingsPanels: z.array(workbenchExtensionSettingsPanelRecordSchema),
  commandPaletteResources: z.array(extensionCommandPaletteResourceRecordSchema).optional(),
  keybindings: z.array(extensionKeybindingRecordSchema).optional(),
  settingsDefinitions: z.array(extensionSettingDefinitionRecordSchema).optional(),
  automations: z.array(workbenchExtensionAutomationRecordSchema).optional(),
  connections: z.array(workbenchExtensionConnectionRecordSchema).optional(),
  harnesses: z
    .array(
      z.object({
        id: z.string(),
        localId: z.string(),
        extensionId: z.string(),
        label: localizableStringSchema.optional(),
      }),
    )
    .optional(),
  skills: z
    .array(
      z.object({
        id: z.string(),
        localId: z.string(),
        extensionId: z.string(),
        title: localizableStringSchema.optional(),
      }),
    )
    .optional(),
  templates: z
    .array(
      z.object({
        id: z.string(),
        localId: z.string(),
        extensionId: z.string(),
        title: localizableStringSchema.optional(),
      }),
    )
    .optional(),
  templateTypes: z
    .array(
      z.object({
        id: z.string(),
        localId: z.string(),
        extensionId: z.string(),
        label: localizableStringSchema,
        description: localizableStringSchema.optional(),
        order: z.number().optional(),
        commands: z.object({ list: z.string(), read: z.string(), save: z.string(), delete: z.string() }).optional(),
      }),
    )
    .optional(),
  themes: z
    .array(
      z.object({
        id: z.string(),
        localId: z.string(),
        extensionId: z.string(),
        title: localizableStringSchema.optional(),
      }),
    )
    .optional(),
  diagnostics: z.array(extensionDiagnosticSchema),
});

export type WorkbenchExtensionMetadata = z.infer<typeof workbenchExtensionMetadataSchema>;
export type WorkbenchExtensionViewRecord = z.infer<typeof workbenchExtensionViewRecordSchema>;
export type WorkbenchExtensionViewBody = z.infer<typeof workbenchExtensionViewBodySchema>;
export type WorkbenchExtensionStatusRecord = z.infer<typeof workbenchExtensionStatusRecordSchema>;
export type WorkbenchExtensionStatusRef = z.infer<typeof statusRefSchema>;
export type WorkbenchExtensionHarnessRecord = NonNullable<WorkbenchExtensionMetadata["harnesses"]>[number];
