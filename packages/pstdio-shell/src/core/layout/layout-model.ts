import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { ResourceRef } from "../resources/resource-registry";

export const shellAreas = ["activityBar", "left", "main", "right", "bottom", "status", "overlay", "floating"] as const;

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

export interface WidgetContribution {
  id: string;
  title: string;
  area: ShellArea;
  fallbackArea?: ShellArea;
  singleton?: boolean;
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

interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  area?: ShellArea;
  pinned?: boolean;
  closable?: boolean;
}

const createAreaState = (id: ShellArea) => ({
  id,
  visible: true,
  widgets: [],
});

const createAreas = () => ({
  activityBar: createAreaState("activityBar"),
  left: createAreaState("left"),
  main: createAreaState("main"),
  right: createAreaState("right"),
  bottom: createAreaState("bottom"),
  status: createAreaState("status"),
  overlay: createAreaState("overlay"),
  floating: createAreaState("floating"),
});

export const createLayoutModel = () => {
  const widgets = new Map<string, RegisteredWidgetContribution>();
  const layout: ShellLayout = {
    areas: createAreas(),
  };
  let placementCounter = 0;

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

  const activatePlacement = (area: ShellAreaState, placement: ShellWidgetPlacement) => {
    area.activeWidgetId = placement.widgetId;
    layout.activeWidgetId = placement.widgetId;
    layout.activeResourceUri = placement.resourceUri;
  };

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
        if (widgets.get(widget.id) === record) widgets.delete(widget.id);
      });
    },

    getWidget(id: string) {
      return widgets.get(id);
    },

    listWidgets() {
      return [...widgets.values()].sort(byContributionPriority);
    },

    openWidget(id: string, input: OpenWidgetInput = {}) {
      const widget = findWidget(id);
      const existing = widget.singleton ? findPlacement(widget.id) : undefined;

      if (existing) {
        activatePlacement(existing.area, existing.placement);
        return existing.placement;
      }

      const areaId = input.area ?? widget.area ?? widget.fallbackArea ?? "main";
      const area = layout.areas[areaId];
      const hasPlacement = area.widgets.some((placement) => placement.widgetId === widget.id);
      if (hasPlacement) placementCounter += 1;
      const widgetId = hasPlacement ? `${widget.id}:${placementCounter}` : widget.id;
      const placement = {
        widgetId,
        contributionId: widget.id,
        resourceUri: input.resource?.uri,
        title: input.title ?? input.resource?.label ?? widget.title,
        pinned: input.pinned,
        closable: input.closable ?? true,
      };

      area.widgets.push(placement);
      activatePlacement(area, placement);

      return placement;
    },

    getLayout() {
      return layout;
    },
  };
};

export type LayoutModel = ReturnType<typeof createLayoutModel>;
