import type { WidgetContribution } from "../../core";

export const ITEM_KIND = "onboarding.side-panels.item";
export const RESOURCE_PICKER_WIDGET_ID = "onboarding.side-panels.resources";
export const RESOURCE_PICKER_RENDERER_ID = "onboarding.side-panels.resources.renderer";
export const CONTEXT_WIDGET_ID = "onboarding.side-panels.context";
export const CONTEXT_RENDERER_ID = "onboarding.side-panels.context.renderer";
export const PROPERTIES_WIDGET_ID = "onboarding.side-panels.properties";
export const DETAIL_WIDGET_ID = "onboarding.side-panels.detail";
export const DETAIL_RENDERER_ID = "onboarding.side-panels.detail.renderer";
export const INSPECTOR_WIDGET_ID = "onboarding.side-panels.inspector";
export const INSPECTOR_RENDERER_ID = "onboarding.side-panels.inspector.renderer";
export const INSPECTOR_CONTEXT_WIDGET_ID = "onboarding.side-panels.inspector-context";
export const INSPECTOR_PROPERTIES_WIDGET_ID = "onboarding.side-panels.inspector-properties";
export const ACTIVITY_WIDGET_ID = "onboarding.side-panels.activity";
export const ACTIVITY_CONTEXT_WIDGET_ID = "onboarding.side-panels.activity-context";
export const ACTIVITY_PROPERTIES_WIDGET_ID = "onboarding.side-panels.activity-properties";
export const STATUS_WIDGET_ID = "onboarding.side-panels.status";

export const sidePanelWidgets = [
  {
    id: RESOURCE_PICKER_WIDGET_ID,
    title: "Resources",
    area: "left",
    areaSize: { defaultPx: 220, minPx: 180 },
    rendererId: RESOURCE_PICKER_RENDERER_ID,
  },
  {
    id: CONTEXT_WIDGET_ID,
    title: "Context",
    area: "main",
    menu: { host: DETAIL_WIDGET_ID, side: "left", icon: "ListTree" },
    rendererId: CONTEXT_RENDERER_ID,
  },
  {
    id: PROPERTIES_WIDGET_ID,
    title: "Properties",
    area: "main",
    menu: { host: DETAIL_WIDGET_ID, side: "right", icon: "SlidersHorizontal" },
    rendererId: CONTEXT_RENDERER_ID,
  },
  {
    id: DETAIL_WIDGET_ID,
    title: "Resource",
    area: "main",
    singleton: false,
    resourceKinds: [ITEM_KIND],
    rendererId: DETAIL_RENDERER_ID,
  },
  {
    id: INSPECTOR_WIDGET_ID,
    title: "Inspector",
    area: "side",
    areaSize: { defaultPx: 280, minPx: 220 },
    rendererId: INSPECTOR_RENDERER_ID,
  },
  {
    id: INSPECTOR_CONTEXT_WIDGET_ID,
    title: "Context",
    area: "side",
    menu: { host: INSPECTOR_WIDGET_ID, side: "left", icon: "ListTree" },
    rendererId: CONTEXT_RENDERER_ID,
  },
  {
    id: INSPECTOR_PROPERTIES_WIDGET_ID,
    title: "Properties",
    area: "side",
    menu: { host: INSPECTOR_WIDGET_ID, side: "right", icon: "SlidersHorizontal" },
    rendererId: CONTEXT_RENDERER_ID,
  },
  {
    id: ACTIVITY_WIDGET_ID,
    title: "Activity",
    area: "secondary",
    rendererId: INSPECTOR_RENDERER_ID,
  },
  {
    id: ACTIVITY_CONTEXT_WIDGET_ID,
    title: "Context",
    area: "secondary",
    menu: { host: ACTIVITY_WIDGET_ID, side: "left", icon: "ListTree" },
    rendererId: CONTEXT_RENDERER_ID,
  },
  {
    id: ACTIVITY_PROPERTIES_WIDGET_ID,
    title: "Properties",
    area: "secondary",
    menu: { host: ACTIVITY_WIDGET_ID, side: "right", icon: "SlidersHorizontal" },
    rendererId: CONTEXT_RENDERER_ID,
  },
  {
    id: STATUS_WIDGET_ID,
    title: "Workbench status",
    area: "status",
    rendererId: STATUS_WIDGET_ID,
  },
] satisfies WidgetContribution[];
