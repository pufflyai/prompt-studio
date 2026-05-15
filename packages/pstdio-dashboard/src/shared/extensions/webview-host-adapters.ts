import { toaster } from "@pstdio/ui";
import { createDashboardWebviewHostCapabilities } from "./webview-host-capabilities";

const dispatchHostKeyboardEvent = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
};

const openDashboardResource = (input: unknown, navigate: (options: { to: string }) => void) => {
  const record = input as { href?: unknown };
  if (typeof record.href !== "string" || record.href.length === 0) {
    throw new Error("resource.open requires href in dashboard webviews.");
  }
  if (/^https?:\/\//.test(record.href)) {
    window.open(record.href, "_blank", "noopener,noreferrer");
    return;
  }
  navigate({ to: record.href });
};

interface DashboardExtensionWebviewHostDeps {
  executeCommand: (input: { commandId: string; body: unknown }) => Promise<unknown>;
  navigate: (options: { to: string }) => void;
  projectId?: string;
  themePreference: string;
  setThemePreference: (preference: string) => void;
}

// Wraps the dashboard webview host-capability registry with the standard dashboard adapters:
// the extension command REST API, router-backed `resource.open`, and toaster notifications.
export const createDashboardExtensionWebviewHostCapabilities = (deps: DashboardExtensionWebviewHostDeps) =>
  createDashboardWebviewHostCapabilities({
    dispatchKeyboardEvent: dispatchHostKeyboardEvent,
    executeCommand: deps.executeCommand,
    openResource: (input) => openDashboardResource(input, deps.navigate),
    projectId: deps.projectId,
    setThemePreference: deps.setThemePreference,
    showNotification: (notification) =>
      toaster.create({
        description: notification.message,
        title: notification.title,
        type: notification.level,
      }),
    themePreference: deps.themePreference,
  });
