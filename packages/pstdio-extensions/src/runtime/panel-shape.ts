import type { LegacyPanelContribution, PanelContribution } from "@pstdio/sdk/extensions";

// During the composition rollout a panel is either the legacy alpha shape (region +
// closable) or the replacement capability shape (supportedRegions). PS-270 deletes the
// legacy shape together with this guard.
export const isLegacyPanelContribution = (panel: PanelContribution): panel is LegacyPanelContribution =>
  "region" in panel;
