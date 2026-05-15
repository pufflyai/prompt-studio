import type { RegisteredContributionMetadata } from "../../shared/contributions/metadata";
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

export interface ShellLayoutStoreState {
  layout: ShellLayout;
  widgets: Record<string, RegisteredWidgetContribution>;
}

export interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  area?: ShellArea;
  pinned?: boolean;
  closable?: boolean;
  replaceActive?: boolean;
}

const createAreaState = (id: ShellArea): ShellAreaState => ({
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

export const mergeWithDefaultAreas = (persisted: ShellLayout): ShellLayout => {
  const defaults = createDefaultShellLayout();
  return {
    ...persisted,
    areas: { ...defaults.areas, ...persisted.areas },
  };
};
