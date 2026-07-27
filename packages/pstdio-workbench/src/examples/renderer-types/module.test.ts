import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "../../extensions";
import { bridgeWidgetId } from "./data";
import { createRendererTypesExampleModule } from "./module";

describe("createRendererTypesExampleModule", () => {
  test("uses the packaged bridge webview renderer for the bridge widget", () => {
    const workbench = createWorkbenchCore();
    let disposed = false;
    const registration = workbench.registerModule(
      createRendererTypesExampleModule({
        createBridgeDocument: () => ({
          moduleUrl: "blob:bridge-module",
          runtimeUrl: "blob:bridge-runtime",
          dispose: () => {
            disposed = true;
          },
        }),
      }),
    );

    try {
      const widget = workbench.layout.getPanel(bridgeWidgetId);
      expect(widget?.rendererId).toBe(BRIDGE_WEBVIEW_RENDERER_ID);
      expect(workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID)).toBeDefined();
      expect(widget?.config).toMatchObject({
        capabilities: ["commands.execute", "notification.show"],
        moduleUrl: expect.any(String),
        runtimeUrl: expect.any(String),
      });
    } finally {
      registration.dispose();
    }

    expect(disposed).toBe(true);
  });
});
