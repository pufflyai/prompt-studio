import type { ModeRegionSettings } from "@pstdio/sdk/extensions";
import { normalizeTarget } from "./workbench-extension-metadata-normalizers";

export const panelSettingsMetadata = <Region extends string>(
  settings: Readonly<Partial<Record<Region, ModeRegionSettings>>> | undefined,
  extensionId: string,
) =>
  settings
    ? Object.fromEntries(
        Object.entries<ModeRegionSettings | undefined>(settings).map(([region, policy]) => [
          region,
          {
            ...policy,
            defaultTab: policy?.defaultTab ? normalizeTarget(policy.defaultTab, extensionId) : undefined,
          },
        ]),
      )
    : undefined;
