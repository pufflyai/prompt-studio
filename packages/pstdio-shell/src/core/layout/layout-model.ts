import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { ResourceRef } from "../resources/resource-registry";

export const shellAreas = [
  "top",
  "activityBar",
  "left-header",
  "left",
  "main-header",
  "main-left-header",
  "main-left",
  "main",
  "main-right-header",
  "main-right",
  "main-bottom-header",
  "main-bottom",
  "status",
  "overlay",
  "floating-header",
  "floating",
] as const;

export type ShellArea = (typeof shellAreas)[number];

export interface WebviewDescriptor {
  title?: string;
  sandbox?: "default" | "strict";
  assetUrl?: string;
  runtimeUrl?: string;
  moduleUrl?: string;
  styles?: string[];
  entry?: {
    kind: "package-asset";
    path: string;
    baseUrl: string;
  };
  capabilities?: string[];
}

export interface ShellAreaSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

export interface WidgetContribution {
  id: string;
  title: string;
  area: ShellArea;
  fallbackArea?: ShellArea;
  singleton?: boolean;
  areaSize?: ShellAreaSize;
  areaCollapsible?: boolean;
  resourceKinds?: string[];
  priority?: number;
  renderer: "webview" | "react" | string;
  rendererId?: string;
  webview?: WebviewDescriptor;
  canOpen?(resource: ResourceRef): boolean;
}

export type RegisteredWidgetContribution = Omit<WidgetContribution, "priority"> & RegisteredContributionMetadata;

export interface ShellWidgetPlacement {
  widgetId: string;
  contributionId: string;
  resource?: ResourceRef;
  resourceUri?: string;
  title?: string;
  pinned?: boolean;
  closable?: boolean;
}

export interface ShellAreaState {
  id: ShellArea;
  visible: boolean;
  size?: number;
  widgets: ShellWidgetPlacement[];
  activeWidgetId?: string;
}

export interface ShellLayout {
  areas: Record<ShellArea, ShellAreaState>;
  activeWidgetId?: string;
  activeResourceUri?: string;
}

export interface LayoutPersistenceAdapter {
  getLayout(): ShellLayout | undefined;
  setLayout(layout: ShellLayout): void;
}

export interface CreateLayoutModelInput {
  persistence?: LayoutPersistenceAdapter;
}

interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  area?: ShellArea;
  pinned?: boolean;
  closable?: boolean;
  replaceActive?: boolean;
}

const createAreaState = (id: ShellArea) => ({
  id,
  visible: true,
  widgets: [],
});

export const createDefaultShellLayout = (): ShellLayout => ({
  areas: {
    top: createAreaState("top"),
    activityBar: createAreaState("activityBar"),
    "left-header": createAreaState("left-header"),
    left: createAreaState("left"),
    "main-header": createAreaState("main-header"),
    "main-left-header": createAreaState("main-left-header"),
    "main-left": createAreaState("main-left"),
    main: createAreaState("main"),
    "main-right-header": createAreaState("main-right-header"),
    "main-right": createAreaState("main-right"),
    "main-bottom-header": createAreaState("main-bottom-header"),
    "main-bottom": createAreaState("main-bottom"),
    status: createAreaState("status"),
    overlay: createAreaState("overlay"),
    "floating-header": createAreaState("floating-header"),
    floating: createAreaState("floating"),
  },
});

const mergeWithDefaultAreas = (persisted: ShellLayout): ShellLayout => {
  const defaults = createDefaultShellLayout();
  return {
    ...persisted,
    areas: { ...defaults.areas, ...persisted.areas },
  };
};

export const createLayoutModel = (input: CreateLayoutModelInput = {}) => {
  const widgets = new Map<string, RegisteredWidgetContribution>();
  const persisted = input.persistence?.getLayout();
  const layout: ShellLayout = persisted ? mergeWithDefaultAreas(persisted) : createDefaultShellLayout();
  let placementCounter = 0;

  const persistLayout = () => {
    input.persistence?.setLayout(layout);
  };

  const findWidget = (id: string) => {
    const widget = widgets.get(id);
    if (!widget) throw new Error(`Widget not registered: ${id}`);
    return widget;
  };

  const findPlacement = (contributionId: string) => {
    for (const area of Object.values(layout.areas)) {
      const placement = area.widgets.find((candidate) => candidate.contributionId === contributionId);
      if (placement) return { area, placement };
    }
    return undefined;
  };

  const getActivePlacement = (area: ShellAreaState) =>
    area.widgets.find((placement) => placement.widgetId === area.activeWidgetId) ?? area.widgets[0];

  const activatePlacement = (area: ShellAreaState, placement: ShellWidgetPlacement) => {
    area.activeWidgetId = placement.widgetId;
    layout.activeWidgetId = placement.widgetId;
    layout.activeResourceUri = placement.resourceUri;
  };

  const updatePlacement = (
    placement: ShellWidgetPlacement,
    widget: RegisteredWidgetContribution,
    input: OpenWidgetInput,
  ) => {
    if (input.resource) {
      placement.resource = input.resource;
      placement.resourceUri = input.resource.uri;
      placement.title = input.title ?? input.resource.label ?? widget.title;
    } else if (input.title !== undefined) {
      placement.title = input.title;
    }

    if (input.pinned !== undefined) placement.pinned = input.pinned;
    if (input.closable !== undefined) placement.closable = input.closable;
  };

  const createPlacement = (
    widgetId: string,
    widget: RegisteredWidgetContribution,
    input: OpenWidgetInput,
  ): ShellWidgetPlacement => ({
    widgetId,
    contributionId: widget.id,
    resource: input.resource,
    resourceUri: input.resource?.uri,
    title: input.title ?? input.resource?.label ?? widget.title,
    pinned: input.pinned,
    closable: input.closable ?? true,
  });

  return {
    registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata) {
      if (widgets.has(widget.id)) throw new Error(`Widget already registered: ${widget.id}`);

      const { priority, ...widgetContribution } = widget;
      const record = {
        ...widgetContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      widgets.set(widget.id, record);

      return createDisposable(() => {
        if (widgets.get(widget.id) !== record) return;
        widgets.delete(widget.id);

        for (const area of Object.values(layout.areas)) {
          area.widgets = area.widgets.filter((placement) => placement.contributionId !== widget.id);
          if (area.activeWidgetId && !area.widgets.some((placement) => placement.widgetId === area.activeWidgetId)) {
            area.activeWidgetId = undefined;
          }
        }
        if (layout.activeWidgetId && !findPlacement(widget.id) && layout.activeWidgetId.startsWith(widget.id)) {
          layout.activeWidgetId = undefined;
          layout.activeResourceUri = undefined;
        }
        persistLayout();
      });
    },

    getWidget(id: string) {
      return widgets.get(id);
    },

    getAreaSize(areaId: ShellArea) {
      const placement = getActivePlacement(layout.areas[areaId]);
      if (!placement) return undefined;

      return widgets.get(placement.contributionId)?.areaSize;
    },

    getAreaCollapsible(areaId: ShellArea) {
      const placement = getActivePlacement(layout.areas[areaId]);
      if (!placement) return true;

      return widgets.get(placement.contributionId)?.areaCollapsible ?? true;
    },

    listWidgets() {
      return [...widgets.values()].sort(byContributionPriority);
    },

    openWidget(id: string, input: OpenWidgetInput = {}) {
      const widget = findWidget(id);
      const existing = widget.singleton ? findPlacement(widget.id) : undefined;

      if (existing) {
        updatePlacement(existing.placement, widget, input);
        activatePlacement(existing.area, existing.placement);
        persistLayout();
        return existing.placement;
      }

      const areaId = input.area ?? widget.area ?? widget.fallbackArea ?? "main";
      const area = layout.areas[areaId];
      const replacementIndex = input.replaceActive
        ? area.widgets.findIndex((placement) => placement.widgetId === area.activeWidgetId && !placement.pinned)
        : -1;
      const replacement = replacementIndex >= 0 ? area.widgets[replacementIndex] : undefined;

      if (replacement?.contributionId === widget.id) {
        updatePlacement(replacement, widget, input);
        activatePlacement(area, replacement);
        persistLayout();
        return replacement;
      }

      const hasPlacement = area.widgets.some(
        (placement, index) => index !== replacementIndex && placement.widgetId === widget.id,
      );
      if (hasPlacement) placementCounter += 1;
      const widgetId = hasPlacement ? `${widget.id}:${placementCounter}` : widget.id;
      const placement = createPlacement(widgetId, widget, input);

      if (replacementIndex >= 0) {
        area.widgets.splice(replacementIndex, 1, placement);
      } else {
        area.widgets.push(placement);
      }
      activatePlacement(area, placement);
      persistLayout();

      return placement;
    },

    activateWidget(widgetId: string) {
      for (const area of Object.values(layout.areas)) {
        const placement = area.widgets.find((candidate) => candidate.widgetId === widgetId);
        if (placement) {
          activatePlacement(area, placement);
          persistLayout();
          return placement;
        }
      }

      throw new Error(`Widget placement not found: ${widgetId}`);
    },

    getLayout() {
      return layout;
    },
  };
};

export type LayoutModel = ReturnType<typeof createLayoutModel>;
