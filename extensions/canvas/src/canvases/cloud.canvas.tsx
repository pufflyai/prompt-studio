import * as Settings from "./cloud-settings-previews";
import * as Status from "./cloud-status-previews";

export default { title: "Extensions/Prompt Studio Cloud/Overview" };

export const CloudStatusStates = {
  name: "Status bar states",
  render: Status.CloudStatusStates,
};
export const CloudPopoverSynced = {
  name: "Synced popover",
  render: Status.CloudPopoverSynced,
};
export const CloudPopoverOffline = {
  name: "Offline popover",
  render: Status.CloudPopoverOffline,
};
export const CloudPopoverComingSoon = {
  name: "Coming soon popover",
  render: Status.CloudPopoverComingSoon,
};
export const CloudSettingsConnected = {
  name: "Connected settings",
  render: Settings.CloudSettingsConnected,
};
export const CloudSettingsLocal = {
  name: "Local project settings",
  render: Settings.CloudSettingsLocal,
};
export const CloudSettingsComingSoon = {
  name: "Coming soon settings",
  render: Settings.CloudSettingsComingSoon,
};
export const CloudMakeLocalConfirmation = {
  name: "Make local confirmation",
  render: Settings.CloudMakeLocalConfirmation,
};
