import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { BridgeWebviewConfig } from "./bridge-webview-renderer";

type WorkbenchWebview = Extract<WorkbenchExtensionMetadata["views"][number]["body"], { kind: "webview" }>["webview"];

export const toBridgeWebviewConfig = (webview: WorkbenchWebview): BridgeWebviewConfig => {
  const title = text(webview.title);
  return {
    title: title || undefined,
    runtimeUrl: webview.runtimeUrl,
    moduleUrl: webview.moduleUrl,
    styles: webview.styles,
    capabilities: webview.capabilities,
  };
};
