import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ParamObjectSchema } from "pstdio-api-contracts";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import { metadataCommandId, metadataRefId, toInternalWhen } from "./workbench-extension-metadata-ref";

type MetadataView = WorkbenchExtensionMetadata["views"][number];

const resourceKindForView = (metadata: WorkbenchExtensionMetadata, viewId: string) =>
  metadata.resourceViews.find((edge) => metadataRefId(edge.view) === viewId)?.resourceKind.id;

const panelPlacements = (metadata: WorkbenchExtensionMetadata, viewId: string) => {
  const direct = metadata.placements.flatMap((placement) =>
    placement.item.kind === "view" && metadataRefId(placement.item.view) === viewId
      ? [
          {
            region: placement.region,
            allowedRegions: placement.movableTo,
            required: placement.required,
          },
        ]
      : [],
  );
  const edges = metadata.resourceViews.filter((edge) => metadataRefId(edge.view) === viewId);
  const resource = edges.flatMap((edge) =>
    metadata.placements.flatMap((placement) =>
      placement.item.kind === "resource-slot" &&
      placement.item.slot.id === edge.slot.id &&
      placement.item.slot.resourceKind.id === edge.resourceKind.id
        ? [
            {
              for: edge.resourceKind.id,
              region: placement.region,
              allowedRegions: placement.movableTo,
              required: placement.required,
            },
          ]
        : [],
    ),
  );
  return [...direct, ...resource];
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
    const placements = panelPlacements(metadata, view.id);
    const menus = panelMenus(metadata, view);
    return {
      id: view.id,
      extensionId: view.extensionId,
      title: view.title,
      path: view.path,
      icon: view.icon,
      show: placements.length === 0 ? undefined : placements.length === 1 ? placements[0] : placements,
      panelMenus: menus.length > 0 ? menus : undefined,
      ...viewBody(view),
    } as InternalWorkbenchExtensionMetadata["panels"][number];
  });

const commandActions = <T extends { command: { extensionId: string; id: string } }>(actions: T[] | undefined) =>
  actions?.map(({ command, ...action }) => ({ ...action, commandId: metadataCommandId(command) }));

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
  metadata.modes.map((mode) => {
    const placements = metadata.placements.filter((placement) => metadataRefId(placement.mode) === mode.id);
    const panelRegions = [
      ...new Set(placements.flatMap((placement) => [placement.region, ...(placement.movableTo ?? [])])),
    ].filter((region) => region !== "sidenav");
    const modePanels = Object.fromEntries(
      placements.flatMap((placement) =>
        placement.item.kind === "view"
          ? [
              [
                metadataRefId(placement.item.view),
                {
                  region: placement.region,
                  allowedRegions: placement.movableTo,
                  required: placement.required,
                  defaultOpen: placement.required ? true : placement.defaultOpen,
                },
              ],
            ]
          : [],
      ),
    );
    const resources = Object.fromEntries(
      metadata.resourceKinds.flatMap((kind) => {
        const slots = Object.fromEntries(
          placements.flatMap((placement) =>
            placement.item.kind === "resource-slot" && placement.item.slot.resourceKind.id === kind.id
              ? [
                  [
                    placement.item.slot.id,
                    {
                      region: placement.region,
                      allowedRegions: placement.movableTo,
                      required: placement.required,
                      defaultOpen: placement.required ? true : placement.defaultOpen,
                    },
                  ],
                ]
              : [],
          ),
        );
        return Object.keys(slots).length > 0 ? [[kind.id, { slots }]] : [];
      }),
    );
    return {
      id: mode.id,
      extensionId: mode.extensionId,
      modeId: mode.id,
      label: mode.label,
      icon: mode.icon,
      panelRegions: panelRegions.length > 0 ? panelRegions : undefined,
      resources,
      modePanels,
    } as InternalWorkbenchExtensionMetadata["modes"][number];
  });

export const toInternalWorkbenchExtensionMetadata = (
  metadata: WorkbenchExtensionMetadata,
): InternalWorkbenchExtensionMetadata => {
  const adaptedPanels = panels(metadata);
  return {
    extensions: metadata.extensions,
    commands: metadata.commands,
    menuContributions: metadata.menuContributions,
    commandPaletteContributions: metadata.commandPaletteContributions,
    modes: modes(metadata),
    panels: adaptedPanels,
    resourceKinds: metadata.resourceKinds.map((kind) => ({
      id: kind.id,
      extensionId: kind.extensionId,
      surface: kind.surface,
      label: kind.label,
      icon: kind.icon,
      slots: Object.fromEntries(
        (kind.slots ?? []).map((slot) => [
          slot.id,
          { cardinality: slot.cardinality, external: slot.access === "public" },
        ]),
      ),
    })),
    resourcePanels: metadata.resourceViews.map((edge) => ({
      id: edge.id,
      extensionId: edge.extensionId,
      resourceKind: edge.resourceKind.id,
      panel: metadataRefId(edge.view),
      slot: edge.slot.id,
    })),
    resourceHierarchyProviders: (metadata.resourceHierarchyProviders ?? []).map((record) => ({
      id: record.id,
      extensionId: record.extensionId,
      resourceKind: record.resourceKind.id,
    })),
    routes: [],
    treeItems: [],
    activityItems: (metadata.activityItems ?? []).map((item) => ({
      id: item.id,
      extensionId: item.extensionId,
      title: item.title,
      icon: item.icon,
      modes: item.modes.map(metadataRefId),
      placement: item.placement,
      commandId: metadataCommandId(item.command),
      params: item.params,
    })),
    settingsSections: metadata.settingsSections ?? [],
    settingsPanels: metadata.settingsPanels.flatMap((panel) => {
      const view = metadata.views.find((candidate) => candidate.id === metadataRefId(panel.view));
      if (!view || view.body.kind !== "webview") return [];
      return [
        {
          id: panel.id,
          extensionId: panel.extensionId,
          slotId: panel.slot.id,
          scope: panel.slot.id.includes("global") ? ("global" as const) : ("project" as const),
          title: view.title,
          icon: view.icon,
          section: panel.section ? metadataRefId(panel.section) : undefined,
          webview: view.body.webview,
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
