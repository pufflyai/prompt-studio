import type { WorkbenchRegionState } from "../../registries/layout/layout-types";
import type { WorkbenchPanelPolicy } from "./panel-policy";

type ToggleRegion = "sidenav" | "secondary" | "side";
interface PanelTogglesInput {
  regions: Partial<Record<ToggleRegion, Pick<WorkbenchRegionState, "edge">>>;
  policies: Record<ToggleRegion, Pick<WorkbenchPanelPolicy, "provided" | "canToggle" | "open">>;
}

/** Navigation is outermost, Side is beside the page, and Secondary is in its middle. */
export const resolvePanelToggles = (input: PanelTogglesInput) => {
  const navigationRight = input.regions.sidenav?.edge === "right";
  const sideLeft = input.regions.side?.edge === "left";
  const order: ToggleRegion[] = [
    ...(navigationRight ? [] : ["sidenav" as const]),
    ...(sideLeft ? ["side" as const] : []),
    "secondary",
    ...(sideLeft ? [] : ["side" as const]),
    ...(navigationRight ? ["sidenav" as const] : []),
  ];
  const names = { sidenav: "Navigation", secondary: "Bottom panel", side: "Sidebar" };
  const icons = {
    sidenav: "ListTree",
    secondary: input.regions.secondary?.edge === "top" ? "PanelTop" : "PanelBottom",
    side: sideLeft ? "PanelLeft" : "PanelRight",
  };
  return order
    .filter((region) => input.policies[region].provided && input.policies[region].canToggle)
    .map((region) => ({
      region,
      icon: icons[region],
      label: `${input.policies[region].open ? "Hide" : "Show"} ${names[region]}`,
      open: input.policies[region].open,
    }));
};

export const resolveStatusBarVisible = (chrome: string | false | undefined, itemCount: number, toggleCount: number) =>
  toggleCount > 0 || (chrome !== undefined ? chrome !== false : itemCount > 0);
