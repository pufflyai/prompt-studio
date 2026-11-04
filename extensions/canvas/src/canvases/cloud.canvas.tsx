import * as Settings from "./cloud-settings-previews";
import * as Status from "./cloud-status-previews";

export default { title: "Extensions/Prompt Studio Cloud" };

export const CloudStatusStates = {
  name: "Cloud · Status bar · All states",
  render: Status.CloudStatusStates,
};
export const CloudPopoverSynced = {
  name: "Cloud · Popover · Synced",
  render: Status.CloudPopoverSynced,
};
export const CloudPopoverOffline = {
  name: "Cloud · Popover · Offline",
  render: Status.CloudPopoverOffline,
};
export const CloudPopoverComingSoon = {
  name: "Cloud · Popover · Coming soon",
  render: Status.CloudPopoverComingSoon,
};
export const CloudSettingsConnected = {
  name: "Cloud · Settings · Early access",
  render: Settings.CloudSettingsConnected,
};
export const CloudSettingsLocal = {
  name: "Cloud · Settings · Local project",
  render: Settings.CloudSettingsLocal,
};
export const CloudSettingsComingSoon = {
  name: "Cloud · Settings · Coming soon",
  render: Settings.CloudSettingsComingSoon,
};
export const CloudMakeLocalConfirmation = {
  name: "Cloud · Make local · Confirmation",
  render: Settings.CloudMakeLocalConfirmation,
};
