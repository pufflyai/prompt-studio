import type { ResourceRef } from "../../core";

export const SIDE_PANEL_ITEM_KIND = "onboarding.side-panels.item";

export interface SidePanelItem {
  id: string;
  label: string;
  status: string;
  owner: string;
  summary: string;
  files: string[];
  activity: string[];
}

export const sidePanelItems: SidePanelItem[] = [
  {
    id: "design-brief",
    label: "Design brief",
    status: "Draft",
    owner: "Product",
    summary: "Define the first-pass layout and panel responsibilities for the onboarding shell.",
    files: ["brief.md", "wireframes/workbench-panels.fig", "src/onboarding/outline.ts"],
    activity: ["Left outline refreshed", "Inspector picked up Product owner", "Primary resource changed"],
  },
  {
    id: "api-audit",
    label: "API audit",
    status: "Review",
    owner: "Platform",
    summary: "Check which extension APIs should read primary resource state instead of global active state.",
    files: ["api.md", "surface-map.ts", "workbench-core.test.ts"],
    activity: ["Resource tree selection moved", "Inspector updated status", "Breadcrumbs were replaced"],
  },
  {
    id: "release-notes",
    label: "Release notes",
    status: "Ready",
    owner: "Docs",
    summary: "Document side-panel sync behavior for resource-backed workbench views.",
    files: ["release-notes.md", "onboarding/14-side-panels.docs.mdx"],
    activity: ["Docs owner assigned", "Related files re-scoped", "Primary resource changed"],
  },
];

export const sidePanelItemResource = (item: SidePanelItem): ResourceRef => ({
  kind: SIDE_PANEL_ITEM_KIND,
  uri: `${SIDE_PANEL_ITEM_KIND}:${item.id}`,
  id: item.id,
  label: item.label,
  icon: "FileText",
  metadata: { status: item.status, owner: item.owner },
});

export const findSidePanelItem = (resource: ResourceRef | undefined) =>
  sidePanelItems.find((item) => item.id === resource?.id) ?? sidePanelItems[0];
