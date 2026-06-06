import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "../shared/localization";
import type { BridgeWebviewConfig } from "./bridge-webview-renderer";

type WorkbenchWebview = NonNullable<WorkbenchExtensionMetadata["views"][number]["webview"]>;

export const toBridgeWebviewConfig = (webview: WorkbenchWebview): BridgeWebviewConfig => ({
  title: text(webview.title),
  runtimeUrl: webview.runtimeUrl,
  moduleUrl: webview.moduleUrl,
  styles: webview.styles,
  capabilities: webview.capabilities,
});
