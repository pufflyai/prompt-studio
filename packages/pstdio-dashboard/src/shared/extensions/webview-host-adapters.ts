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

const surfaceActivity = (item: unknown) => {
  const record = item as { message?: unknown; severity?: unknown; title?: unknown };
  if (typeof record.title !== "string") return;
  toaster.create({
    description: typeof record.message === "string" ? record.message : undefined,
    title: record.title,
    type: record.severity === "error" ? "error" : record.severity === "warning" ? "warning" : "info",
  });
};

const surfaceGuestDiagnostic = (diagnostic: unknown) => {
  const record = diagnostic as { message?: unknown; severity?: unknown; source?: unknown };
  if (typeof record.message !== "string") return;
  toaster.create({
    description: typeof record.source === "string" ? record.source : undefined,
    title: record.message,
    type: record.severity === "error" ? "error" : "warning",
  });
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
    emitActivity: surfaceActivity,
    executeCommand: deps.executeCommand,
    openResource: (input) => openDashboardResource(input, deps.navigate),
    projectId: deps.projectId,
    reportDiagnostic: surfaceGuestDiagnostic,
    setThemePreference: deps.setThemePreference,
    showNotification: (notification) =>
      toaster.create({
        description: notification.message,
        title: notification.title,
        type: notification.level,
      }),
    themePreference: deps.themePreference,
  });
