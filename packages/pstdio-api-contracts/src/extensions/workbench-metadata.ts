import { z } from "zod";
import { dockedWorkbenchRegions } from "../extension-kernel/types/composition";
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
import { extensionControlsRendererRecordSchema } from "./controls-renderer";
import { extensionDataTableRendererRecordSchema } from "./data-table-renderer";
import { extensionResourceRefSchema } from "./execute";
import { extensionCommandPaletteResourceRecordSchema, extensionKanbanRendererRecordSchema } from "./kanban-renderer";
import { extensionKeybindingRecordSchema } from "./keybindings";
import { extensionFileRendererRecordSchema, extensionTreeRendererRecordSchema } from "./renderers";
import { extensionSettingDefinitionRecordSchema, extensionSettingsSectionRecordSchema } from "./settings";

const contributionRefSchema = <Kind extends string>(kind: Kind) =>
  z.object({ extensionId: z.string(), kind: z.literal(kind), id: z.string() });

const commandRefSchema = contributionRefSchema("command");
const modeRefSchema = contributionRefSchema("mode");
const navigationSlotRefSchema = contributionRefSchema("navigation-item");
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

const commandTargetSchema = z.object({ command: commandRefSchema, params: jsonObjectSchema.optional() });

const navigationTargetItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("view"),
    view: viewRefSchema,
    input: z
      .object({ strategy: z.enum(["persistent", "preview", "replace-active", "replace-invoking"]).optional() })
      .optional(),
  }),
  z.object({
    kind: z.literal("resource"),
    resource: extensionResourceRefSchema,
    input: z.object({ strategy: z.enum(["persistent", "replace-active"]).optional() }).optional(),
    section: z
      .object({
        anchors: z.array(
          z.object({
            id: z.string(),
            heading: z.string(),
            occurrence: z.number().int().nonnegative().optional(),
          }),
        ),
      })
      .optional(),
  }),
  z.object({ kind: z.literal("command"), target: commandTargetSchema }),
  z.object({ kind: z.literal("href"), href: z.string() }),
]);

const navigationTargetSchema = z.union([
  navigationTargetItemSchema,
  z.object({ kind: z.literal("compound"), targets: z.array(navigationTargetItemSchema).min(1) }),
]);

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
  path: z.string().optional(),
  body: workbenchExtensionViewBodySchema,
});

const workbenchExtensionModeRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
});

const workbenchExtensionPlacementRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  mode: modeRefSchema,
  item: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("view"), view: viewRefSchema }),
    z.object({
      kind: z.literal("resource-slot"),
      slot: z.object({ resourceKind: resourceKindRefSchema, id: z.string() }),
    }),
  ]),
  region: z.enum(dockedWorkbenchRegions),
  order: z.number().optional(),
  defaultOpen: z.boolean().optional(),
  required: z.boolean().optional(),
  movableTo: z.array(z.enum(dockedWorkbenchRegions)).optional(),
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
  slot: navigationSlotRefSchema,
  label: localizableStringSchema,
  icon: z.string().optional(),
  group: z.string().optional(),
  order: z.number().optional(),
  when: normalizedWhenSchema.optional(),
  action: navigationTargetSchema,
});

const workbenchExtensionResourceKindRecordSchema = z.object({
  id: z.string(),
  localId: z.string(),
  extensionId: z.string(),
  surface: z.enum(["primary", "secondary", "attached"]),
  label: localizableStringSchema.optional(),
  icon: z.string().optional(),
  slots: z
    .array(z.object({ id: z.string(), cardinality: z.enum(["one", "many"]), access: z.enum(["owner", "public"]) }))
    .optional(),
});

const workbenchExtensionResourceViewRecordSchema = z.object({
  id: z.string(),
  extensionId: z.string(),
  resourceKind: resourceKindRefSchema,
  slot: z.object({ resourceKind: resourceKindRefSchema, id: z.string() }),
  view: viewRefSchema,
  order: z.number().optional(),
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
  views: z.array(workbenchExtensionViewRecordSchema),
  viewMenus: z.array(workbenchExtensionViewMenuRecordSchema),
  placements: z.array(workbenchExtensionPlacementRecordSchema),
  resourceKinds: z.array(workbenchExtensionResourceKindRecordSchema),
  resourceViews: z.array(workbenchExtensionResourceViewRecordSchema),
  resourceHierarchyProviders: z
    .array(z.object({ id: z.string(), extensionId: z.string(), resourceKind: resourceKindRefSchema }))
    .optional(),
  navigationItems: z.array(workbenchExtensionNavigationItemRecordSchema),
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
