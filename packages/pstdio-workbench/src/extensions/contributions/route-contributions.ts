import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchModuleContext } from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "../bridge/bridge-webview-renderer";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";
import { registerWorkbenchExtensionPanel } from "./panel-contributions";

export interface RegisterWorkbenchExtensionRoutesInput {
  metadata: WorkbenchExtensionMetadata;
  workbench: WorkbenchModuleContext;
}

export const registerWorkbenchExtensionRoutes = (input: RegisterWorkbenchExtensionRoutesInput) => {
  if (input.metadata.routes.length === 0) return [] as Disposable[];
  return input.metadata.routes.map((route) =>
    registerWorkbenchExtensionPanel({
      workbench: input.workbench,
      path: route.path,
      contribution: {
        id: route.id,
        title: text(route.label, route.id),
        region: "main",
        rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
        singleton: true,
        config: toBridgeWebviewConfig(route.webview),
      },
    }),
  );
};
