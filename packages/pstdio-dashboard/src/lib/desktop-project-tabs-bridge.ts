import { DesktopProjectTabsController } from "@/modules/projects/desktop-project-tabs-controller";

interface DesktopProjectTabsBridge {
  getAppInfo: () => Promise<{ platform: string }>;
  getProjectTabs: () => Promise<{ projectIds: string[] }>;
  setProjectTabs: (state: { projectIds: string[] }) => Promise<void>;
}

const hasProjectTabs = (value: unknown): value is DesktopProjectTabsBridge =>
  Boolean(
    value &&
      typeof value === "object" &&
      "getProjectTabs" in value &&
      typeof value.getProjectTabs === "function" &&
      "setProjectTabs" in value &&
      typeof value.setProjectTabs === "function" &&
      "getAppInfo" in value &&
      typeof value.getAppInfo === "function",
  );

export const createDesktopProjectTabs = async (bridge: unknown) => {
  if (!hasProjectTabs(bridge)) return undefined;
  const [state, appInfo] = await Promise.all([bridge.getProjectTabs(), bridge.getAppInfo()]);
  return {
    platform: appInfo.platform,
    controller: new DesktopProjectTabsController(state.projectIds, (value) => bridge.setProjectTabs(value)),
  };
};
