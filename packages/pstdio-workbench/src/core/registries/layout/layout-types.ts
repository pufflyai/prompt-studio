import type { ContributionSource, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { ResourceRef } from "../resources/resource-registry";

export const workbenchAreas = [
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

export type WorkbenchArea = (typeof workbenchAreas)[number];

export interface WorkbenchAreaSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

export interface WidgetContribution {
  id: string;
  title: string;
  area: WorkbenchArea;
  fallbackArea?: WorkbenchArea;
  singleton?: boolean;
  closable?: boolean;
  areaSize?: WorkbenchAreaSize;
  areaCollapsible?: boolean;
  headerBorderBottom?: boolean;
  resourceKinds?: string[];
  priority?: number;
  rendererId: string;
  config?: unknown;
  canOpen?(resource: ResourceRef): boolean;
}

export type RegisteredWidgetContribution = Omit<WidgetContribution, "priority"> & RegisteredContributionMetadata;

export interface AreaPlaceholderContribution {
  id: string;
  title: string;
  area: WorkbenchArea;
  rendererId: string;
  areaSize?: WorkbenchAreaSize;
  areaCollapsible?: boolean;
  config?: unknown;
  priority?: number;
}

export type RegisteredAreaPlaceholderContribution = Omit<AreaPlaceholderContribution, "priority"> &
  RegisteredContributionMetadata;

export interface WorkbenchWidgetPlacement {
  widgetId: string;
  contributionId: string;
  ownerId?: string;
  source?: ContributionSource;
  resource?: ResourceRef;
  resourceUri?: string;
  title?: string;
  pinned?: boolean;
  closable?: boolean;
}

export interface WorkbenchAreaState {
  id: WorkbenchArea;
  visible: boolean;
  size?: number;
  widgets: WorkbenchWidgetPlacement[];
  activeWidgetId?: string;
}

export interface WorkbenchLayout {
  areas: Record<WorkbenchArea, WorkbenchAreaState>;
  activeWidgetId?: string;
  activeResourceUri?: string;
}

export interface WorkbenchLayoutStoreState {
  layout: WorkbenchLayout;
  widgets: Record<string, RegisteredWidgetContribution>;
  areaPlaceholders: Partial<Record<WorkbenchArea, RegisteredAreaPlaceholderContribution>>;
}

export interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  area?: WorkbenchArea;
  ownerId?: string;
  source?: ContributionSource;
  pinned?: boolean;
  closable?: boolean;
  replaceActive?: boolean;
}

const createAreaState = (id: WorkbenchArea): WorkbenchAreaState => ({
  id,
  visible: true,
  widgets: [],
});

export const createDefaultWorkbenchLayout = (): WorkbenchLayout => ({
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

export const mergeWithDefaultAreas = (persisted: WorkbenchLayout): WorkbenchLayout => {
  const defaults = createDefaultWorkbenchLayout();
  return {
    ...persisted,
    areas: { ...defaults.areas, ...persisted.areas },
  };
};
