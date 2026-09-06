import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ParamObjectSchema } from "pstdio-api-contracts";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import { metadataCommandId, metadataRefId, toInternalWhen } from "./workbench-extension-metadata-ref";
import { toInternalWorkbenchPages } from "./workbench-extension-page-metadata";
import type { WorkbenchExtensionTabMetadata } from "./workbench-extension-tab-presentation";

type MetadataView = WorkbenchExtensionMetadata["views"][number];
const resourceKindForView = (metadata: WorkbenchExtensionMetadata, viewId: string) => {
  const bindings = metadata.pages.flatMap((page) => [
    ...(page.main.kind === "view" && page.resource ? [{ ...page.resource, view: page.main.view }] : []),
    ...page.slots.flatMap((slot) => (slot.item.kind === "binding" ? [slot.item.binding] : [])),
  ]);
  bindings.push(
    ...metadata.placements.flatMap((placement) => (placement.item.kind === "binding" ? [placement.item.binding] : [])),
  );
  return bindings.find((binding) => metadataRefId(binding.view) === viewId)?.kinds[0]?.id;
};
const viewBody = (view: MetadataView) =>
  view.body.kind === "webview" ? { webview: view.body.webview } : { renderer: { kind: view.body.kind, id: view.id } };
const panelMenus = (metadata: WorkbenchExtensionMetadata, owner: MetadataView) =>
  metadata.viewMenus.flatMap((menu) => {
    if (metadataRefId(menu.owner) !== owner.id) return [];
    const view = metadata.views.find((candidate) => candidate.id === metadataRefId(menu.view));
    if (!view) return [];
    return [
      {
        id: menu.id,
        extensionId: menu.extensionId,
        ownerPanelId: owner.id,
        viewId: view.id,
        title: view.title,
        side: menu.side,
        group: menu.group,
        placement: menu.placement,
        hostTreeHeader: menu.hostTreeHeader,
        hostTreeFooter: menu.hostTreeFooter,
        ...viewBody(view),
      },
    ];
  });
const panels = (metadata: WorkbenchExtensionMetadata): InternalWorkbenchExtensionMetadata["panels"] =>
  metadata.views.map((view) => {
    const menus = panelMenus(metadata, view);
    return {
      id: view.id,
      extensionId: view.extensionId,
      title: view.title,
      icon: view.icon,
      panelMenus: menus.length > 0 ? menus : undefined,
      ...viewBody(view),
    };
  });
const commandActions = <
  T extends {
    command: {
      extensionId: string;
      id: string;
    };
  },
>(
  actions: T[] | undefined,
) => actions?.map(({ command, ...action }) => ({ ...action, commandId: metadataCommandId(command) }));
const kanbanRenderers = (metadata: WorkbenchExtensionMetadata): InternalWorkbenchExtensionMetadata["kanbanRenderers"] =>
  metadata.views.flatMap((view) => {
    const body = view.body;
    if (body.kind !== "kanban") return [];
    return [
      {
        ...body,
        id: view.id,
        extensionId: view.extensionId,
        title: view.title,
        icon: view.icon,
        resourceKind: resourceKindForView(metadata, view.id),
        createRow: body.createRow
          ? {
              title: body.createRow.title,
              submitLabel: body.createRow.submitLabel,
              columnParam: body.createRow.columnParam,
              params: body.createRow.params as ParamObjectSchema | undefined,
              attributesParam: body.createRow.attributesParam,
              labels: body.createRow.labels,
              commandId: metadataCommandId(body.createRow.command),
              attachments: body.createRow.attachments
                ? {
                    resourceParam: body.createRow.attachments.resourceParam,
                    fileParam: body.createRow.attachments.fileParam,
                    commandId: metadataCommandId(body.createRow.attachments.command),
                  }
                : undefined,
            }
          : undefined,
        rowActions: commandActions(body.rowActions),
      },
    ];
  });
const dataTableRenderers = (
  metadata: WorkbenchExtensionMetadata,
): InternalWorkbenchExtensionMetadata["dataTableRenderers"] =>
  metadata.views.flatMap((view) => {
    const body = view.body;
    if (body.kind !== "dataTable") return [];
    return [
      {
        ...body,
        id: view.id,
        extensionId: view.extensionId,
        title: view.title,
        icon: view.icon,
        resourceKind: resourceKindForView(metadata, view.id),
        selectionActions: commandActions(body.selectionActions),
        rowActions: commandActions(body.rowActions),
      },
    ];
  });
const treeRenderers = (metadata: WorkbenchExtensionMetadata): InternalWorkbenchExtensionMetadata["treeRenderers"] =>
  metadata.views.flatMap((view) =>
    view.body.kind === "tree"
      ? [
          {
            ...view.body,
            id: view.id,
            extensionId: view.extensionId,
            title: view.title,
            icon: view.icon,
            resourceKind: resourceKindForView(metadata, view.id),
          },
        ]
      : [],
  );
const fileRenderers = (metadata: WorkbenchExtensionMetadata): InternalWorkbenchExtensionMetadata["fileRenderers"] =>
  metadata.views.flatMap((view) =>
    view.body.kind === "file"
      ? [
          {
            ...view.body,
            id: view.id,
            extensionId: view.extensionId,
            title: view.title,
            icon: view.icon,
            resourceKind: resourceKindForView(metadata, view.id),
          },
        ]
      : [],
  );
const controlsRenderers = (
  metadata: WorkbenchExtensionMetadata,
): InternalWorkbenchExtensionMetadata["controlsRenderers"] =>
  metadata.views.flatMap((view) =>
    view.body.kind === "controls"
      ? [
          {
            ...view.body,
            id: view.id,
            extensionId: view.extensionId,
            title: view.title,
            icon: view.icon,
            resourceKind: resourceKindForView(metadata, view.id),
          },
        ]
      : [],
  );
const modes = (metadata: WorkbenchExtensionMetadata): InternalWorkbenchExtensionMetadata["modes"] =>
  metadata.modes.map((mode) => ({
    id: mode.id,
    extensionId: mode.extensionId,
    modeId: mode.id,
    label: mode.label,
    icon: mode.icon,
    panelRegions: mode.regions,
    regionSettings: mode.regionSettings,
    floatingPanels: mode.floatingPanels,
    ...(mode.defaultTheme ? { defaultTheme: metadataRefId(mode.defaultTheme) } : {}),
    ...(mode.chrome
      ? {
          chrome: Object.fromEntries(
            Object.entries(mode.chrome).map(([region, view]) => [region, view === false ? false : metadataRefId(view)]),
          ),
        }
      : {}),
  }));
export const toInternalWorkbenchExtensionMetadata = (
  metadata: WorkbenchExtensionMetadata,
  input: {
    createTab?(
      metadata: WorkbenchExtensionTabMetadata,
    ): InternalWorkbenchExtensionMetadata["placements"][number]["tab"];
  } = {},
): InternalWorkbenchExtensionMetadata => {
  const adaptedPanels = panels(metadata);
  return {
    extensions: metadata.extensions,
    commands: metadata.commands,
    menuContributions: metadata.menuContributions,
    commandPaletteContributions: metadata.commandPaletteContributions,
    modes: modes(metadata),
    pages: toInternalWorkbenchPages(metadata, input.createTab),
    placements: metadata.placements.map((placement) => ({
      id: placement.id,
      ref: { extensionId: placement.extensionId, kind: "placement", id: placement.localId },
      modeId: metadataRefId(placement.mode),
      item: placement.item,
      region: placement.region,
      order: placement.order,
      movableTo: placement.movableTo,
      mountStrategy: placement.mountStrategy,
      hiddenByDefault: placement.hiddenByDefault,
      headerBorderBottom: placement.headerBorderBottom,
      tab:
        placement.tab && input.createTab
          ? input.createTab({
              ...placement.tab,
              extensionId: placement.extensionId,
              placementId: placement.id,
            })
          : undefined,
    })),
    panels: adaptedPanels,
    resourceKinds: metadata.resourceKinds.map((kind) => ({
      id: kind.id,
      extensionId: kind.extensionId,
      label: kind.label,
      icon: kind.icon,
      menuSlots: Object.fromEntries(
        (kind.menuSlots ?? []).map((slot) => [
          slot.id,
          {
            placement: slot.placement,
            label: slot.label,
            external: slot.access === "public",
            order: slot.order,
          },
        ]),
      ),
    })),
    resourceHierarchyProviders: (metadata.resourceHierarchyProviders ?? []).map((record) => ({
      id: record.id,
      extensionId: record.extensionId,
      resourceKind: record.resourceKind.id,
    })),
    settingsSections: metadata.settingsSections ?? [],
    settingsPanels: metadata.settingsPanels.flatMap((panel) => {
      const view = metadata.views.find((candidate) => candidate.id === metadataRefId(panel.view));
      if (!view) return [];
      return [
        {
          id: panel.id,
          viewId: view.id,
          extensionId: panel.extensionId,
          slotId: panel.slot.id,
          scope: panel.slot.id.includes("global") ? ("global" as const) : ("project" as const),
          title: view.title,
          icon: view.icon,
          section: panel.section ? metadataRefId(panel.section) : undefined,
        },
      ];
    }),
    kanbanRenderers: kanbanRenderers(metadata),
    dataTableRenderers: dataTableRenderers(metadata),
    commandPaletteResources: metadata.commandPaletteResources ?? [],
    treeRenderers: treeRenderers(metadata),
    fileRenderers: fileRenderers(metadata),
    controlsRenderers: controlsRenderers(metadata),
    keybindings: metadata.keybindings ?? [],
    settingsDefinitions: metadata.settingsDefinitions ?? [],
    statuses: metadata.statuses,
    statusBarItems: metadata.statusBarItems.map((item) => ({
      id: item.id,
      extensionId: item.extensionId,
      viewId: metadataRefId(item.view),
      slot: item.slot.id.endsWith("leading") ? "leading" : "trailing",
      order: item.order,
      when: toInternalWhen(item.when),
    })),
    diagnostics: metadata.diagnostics,
  };
};
