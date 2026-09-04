import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ContributionRef, ExtensionDefinition, RendererCallback, ViewBody } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { emptyWorkbenchExtensionMetadata, registerWorkbenchExtensionContributions } from "../../extensions";

const extensionId = "storybook.guide";
const contributionId = (kind: string, id: string) => `${extensionId}.${kind}.${id}`;
const normalizedRef = <Kind extends string>(ref: { extensionId?: string; kind: Kind; id: string }) => ({
  extensionId: ref.extensionId ?? extensionId,
  kind: ref.kind,
  id: ref.id,
});

const createPreviewMetadata = (definition: ExtensionDefinition) => {
  const handlers = new Map<string, RendererCallback>();
  const handler = (rendererId: string, kind: string, operation: string, callback: unknown) => {
    if (typeof callback !== "function") return undefined;
    const id = `${rendererId}.${kind}.${operation}`;
    handlers.set(id, callback as RendererCallback);
    return id;
  };

  const views = (definition.views ?? []).map((view) => {
    const body = view.body as ViewBody & Record<string, unknown>;
    const id = contributionId("view", view.id);
    let metadataBody: WorkbenchExtensionMetadata["views"][number]["body"];

    if (body.kind === "tree") {
      metadataBody = {
        kind: "tree",
        bodyHandlerId: handler(id, "tree", "body", body.body)!,
        headerHandlerId: handler(id, "tree", "header", body.header),
        childrenHandlerId: handler(id, "tree", "children", body.children),
        footerHandlerId: handler(id, "tree", "footer", body.footer),
        defaultExpandedSectionIds: body.defaultExpandedSectionIds,
        defaultExpandedNodeIds: body.defaultExpandedNodeIds,
        searchable: body.searchable,
        searchPlaceholder: body.searchPlaceholder,
      };
    } else if (body.kind === "dataTable") {
      metadataBody = {
        kind: "dataTable",
        columns: body.columns,
        queryHandlerId: handler(id, "dataTable", "query", body.query)!,
        rowActivationHandlerId: handler(id, "dataTable", "onRowActivate", body.onRowActivate),
        selectionMode: body.selectionMode,
        initialPageSize: body.initialPageSize,
        pageSizeOptions: body.pageSizeOptions,
      };
    } else if (body.kind === "kanban") {
      metadataBody = {
        kind: "kanban",
        attributes: body.attributes?.map((attribute) =>
          attribute.type.kind === "status"
            ? {
                ...attribute,
                type: { ...attribute.type, statuses: normalizedRef(attribute.type.statuses) },
              }
            : attribute,
        ),
        queryHandlerId: handler(id, "kanban", "query", body.query)!,
        attributeChangeHandlerId: handler(id, "kanban", "onAttributeChange", body.onAttributeChange),
        reorderHandlerId: handler(id, "kanban", "onReorder", body.onReorder),
        defaultSettings: body.defaultSettings,
        defaultFilters: body.defaultFilters,
        defaultViews: body.defaultViews,
        defaultActiveViewId: body.defaultActiveViewId,
        hideToolbar: body.hideToolbar,
      };
    } else if (body.kind === "file") {
      metadataBody = {
        kind: "file",
        loadHandlerId: handler(id, "file", "load", body.load)!,
        saveHandlerId: handler(id, "file", "save", body.save),
      };
    } else if (body.kind === "controls") {
      metadataBody = {
        kind: "controls",
        queryHandlerId: handler(id, "controls", "query", body.query)!,
        valueChangeHandlerId: handler(id, "controls", "onValueChange", body.onValueChange),
        applyHandlerId: handler(id, "controls", "onApply", body.onApply),
        resetHandlerId: handler(id, "controls", "onReset", body.onReset),
        defaultValues: body.defaultValues,
        emptyTitle: body.emptyTitle,
        emptyDescription: body.emptyDescription,
      };
    } else {
      throw new Error(`The extension onboarding preview does not support ${body.kind} views`);
    }

    return {
      id,
      localId: view.id,
      extensionId,
      title: view.title,
      icon: view.icon,
      body: metadataBody,
    };
  });

  const statuses = (definition.statuses ?? []).map((status) => {
    const id = contributionId("status", status.id);
    return {
      id,
      localId: status.id,
      extensionId,
      title: status.title,
      actions: status.actions,
      queryHandlerId: handler(id, "status", "query", status.query)!,
      saveHandlerId: handler(id, "status", "save", status.save),
    };
  });

  const pages = (definition.pages ?? []).map((page) => ({
    id: contributionId("page", page.id),
    localId: page.id,
    extensionId,
    title: page.title,
    icon: page.icon,
    path: page.path,
    mode: normalizedRef(page.mode),
    parent: page.parent ? normalizedRef(page.parent) : undefined,
    slots: page.slots.map((slot) => ({
      ...slot,
      view: slot.view ? normalizedRef(slot.view) : undefined,
      binding: slot.binding
        ? {
            kind: Array.isArray(slot.binding.kind)
              ? slot.binding.kind.map((kind) => normalizedRef(kind))
              : normalizedRef(slot.binding.kind as ContributionRef<"resource-kind">),
            view: normalizedRef(slot.binding.view),
          }
        : undefined,
    })),
  }));

  const navigationItems = (definition.navigationItems ?? []).map((item) => ({
    id: contributionId("navigation-item", item.id),
    extensionId,
    owner: normalizedRef(item.owner),
    slot: item.slot ?? "content",
    label: item.label,
    icon: item.icon,
    group: item.group,
    action: item.action.kind === "page" ? { ...item.action, page: normalizedRef(item.action.page) } : item.action,
  }));

  const metadata = {
    ...emptyWorkbenchExtensionMetadata,
    extensions: [
      {
        id: extensionId,
        name: "guide",
        displayName: "Guide",
        version: "1.0.0",
        sourcePath: "/storybook/guide/extension.ts",
      },
    ],
    views,
    statuses,
    pages,
    navigationItems,
  } as WorkbenchExtensionMetadata;

  return { handlers, metadata };
};

export const createExtensionPreview = (definition: ExtensionDefinition, pageId: string) => {
  const { handlers, metadata } = createPreviewMetadata(definition);
  const page = { extensionId, kind: "page" as const, id: pageId };
  const workbench = createWorkbench({ startPage: page });

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.registerModule({
    id: "storybook.extension-preview",
    activate(ctx) {
      return registerWorkbenchExtensionContributions({
        metadata,
        projectId: "storybook",
        workbench: ctx,
        executeCommand: async (commandId, request) => {
          const callback = handlers.get(commandId);
          if (!callback) throw new Error(`Story handler not found: ${commandId}`);
          return callback({} as never, (request.params ?? {}) as never);
        },
      });
    },
  });

  workbench.pageLocations.setProject("storybook");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};
