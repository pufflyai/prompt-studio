import type { WebviewCapabilityDiagnostic } from "../contract";

export const EXTENSION_HOST_LOG_PREFIX = "[pstdio.extension-host] ";

export interface ExtensionHostDiagnostic {
  event: "webview-ready" | "webview-error" | "webview-diagnostic" | "registration-ready" | "registration-error";
  extensionId?: string;
  contributionId?: string;
  projectId?: string;
  code?: string;
  capability?: string;
  message?: string;
  stack?: string;
}

export const logExtensionHostDiagnostic = (diagnostic: ExtensionHostDiagnostic, write = console.info) => {
  write(`${EXTENSION_HOST_LOG_PREFIX}${JSON.stringify(diagnostic)}`);
};

export const createWebviewDiagnostics = (
  view: { extensionId: string; id: string },
  write?: (message: string) => void,
) => {
  const log = (diagnostic: ExtensionHostDiagnostic) =>
    logExtensionHostDiagnostic({ extensionId: view.extensionId, contributionId: view.id, ...diagnostic }, write);
  return {
    onReady: () => log({ event: "webview-ready" }),
    onError: (error: { message: string; stack?: string }) => log({ event: "webview-error", ...error }),
    onDiagnostics: (diagnostics: WebviewCapabilityDiagnostic[]) => {
      for (const diagnostic of diagnostics) log({ event: "webview-diagnostic", ...diagnostic });
    },
  };
};
