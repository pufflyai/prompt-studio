import { dialog } from "electron";
import type { DesktopRecoveryError, RuntimeActivity } from "./lifecycle-machine";
import type { NativeRecoveryAction } from "./recovery-presentation";

const captions: Record<NativeRecoveryAction, string> = { retry: "Retry", open_logs: "Open logs", quit: "Quit" };

export const showNativeRecovery = async (error: DesktopRecoveryError) => {
  const actions = error.actions;
  const quit = actions.indexOf("quit");
  const retry = actions.indexOf("retry");
  const { response } = await dialog.showMessageBox({
    type: "error",
    title: "Prompt Studio",
    message: "Prompt Studio could not open its desktop interface.",
    detail: error.message,
    buttons: actions.map((action) => captions[action]),
    defaultId: retry >= 0 ? retry : quit,
    cancelId: quit,
    noLink: true,
  });
  return actions[response] ?? "quit";
};

// A second quit request may arrive when the dashboard's confirmation is not visible.
export const askToCancelActiveWork = async (activity: RuntimeActivity) => {
  const labels = [...activity.sessions, ...activity.terminals, ...activity.jobs].map((item) => item.label);
  const { response } = await dialog.showMessageBox({
    type: "warning",
    message: "Active work is still running",
    detail: `Canceling this work will stop: ${labels.join(", ")}. This cannot be undone.`,
    buttons: ["Keep Prompt Studio open", "Cancel work and quit"],
    defaultId: 0,
    cancelId: 0,
  });
  return response === 1;
};
