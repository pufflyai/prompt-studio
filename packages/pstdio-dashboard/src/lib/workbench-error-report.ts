import { readBrowserSession } from "./browser-session";

interface WorkbenchErrorReport {
  projectId?: string;
  message: string;
  stack?: string;
  componentStack?: string;
}

type ErrorReportingBridge = { reportWorkbenchError?: (report: WorkbenchErrorReport) => Promise<void> };

export const reportWorkbenchError = (error: unknown, projectId?: string, componentStack?: string | null) => {
  const writeToConsole = () => console.error("Prompt Studio workbench failed", error, componentStack);
  try {
    const bridge = (window as Window & { promptStudioDesktop?: ErrorReportingBridge }).promptStudioDesktop;
    if (!bridge?.reportWorkbenchError) {
      writeToConsole();
      return;
    }
    const secret = readBrowserSession();
    const safeText = (value: string | undefined, limit: number) =>
      (secret ? value?.replaceAll(secret, "[REDACTED]") : value)?.slice(0, limit);
    const message = error instanceof Error ? error.message : error;
    void bridge
      .reportWorkbenchError({
        projectId,
        message: safeText(typeof message === "string" ? message : undefined, 2_000) ?? "Unexpected failure",
        stack: safeText(error instanceof Error ? error.stack : undefined, 12_000),
        componentStack: safeText(componentStack ?? undefined, 12_000),
      })
      .catch(writeToConsole);
  } catch {
    writeToConsole();
  }
};
