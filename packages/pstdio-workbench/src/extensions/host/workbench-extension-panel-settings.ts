import type { ModeRegionSettings, NavigationTarget } from "@pstdio/sdk/extensions";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";

export const adaptPanelSettings = (
  settings: Partial<Record<string, ModeRegionSettings>> | undefined,
  extensionId: string,
) =>
  settings
    ? Object.fromEntries(
        Object.entries(settings).map(([region, policy]) => [
          region,
          {
            ...policy,
            defaultTab: policy?.defaultTab
              ? toWorkbenchNavigationTarget(policy.defaultTab, { extensionId })
              : undefined,
          },
        ]),
      )
    : undefined;

export const adaptFloatingDefaults = (floating: { defaultTab?: NavigationTarget } | undefined, extensionId: string) =>
  floating
    ? {
        defaultTab: floating.defaultTab ? toWorkbenchNavigationTarget(floating.defaultTab, { extensionId }) : undefined,
      }
    : undefined;
