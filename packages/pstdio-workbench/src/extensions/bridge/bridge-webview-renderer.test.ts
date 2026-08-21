import { describe, expect, test } from "bun:test";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { createWorkbenchCore, type WorkbenchPanelInstance } from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID, createBridgeWebviewRenderer } from "./bridge-webview-renderer";

const setupWebviewWidget = () => {
  const workbench = createWorkbenchCore();

  workbench.layout.registerPanel({
    id: "lab.page",
    title: "Lab page",
    region: "main",
    rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
    config: {
      runtimeUrl: "https://host/runtime.html",
      moduleUrl: "https://host/module.js",
      capabilities: ["commands.execute"],
    },
  });

  const widget = workbench.layout.getPanel("lab.page")!;
  const placement: WorkbenchPanelInstance = { instanceId: "lab.page", panelId: "lab.page", closable: false };

  return { workbench, widget, placement };
};

describe("createBridgeWebviewRenderer", () => {
  test("uses the injected createHostCapabilities factory", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const calls: { workbench: unknown; webviewId: string }[] = [];
    const injected: HostCapabilityRegistry = {};

    const renderer = createBridgeWebviewRenderer({
      createHostCapabilities: (context) => {
        calls.push(context);
        return injected;
      },
    });

    const element = renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined }) as {
      props: { capabilities: unknown };
    };

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workbench).toBe(workbench);
    expect(calls[0]?.webviewId).toBe("lab.page");
    expect(element.props.capabilities).toBe(injected);
  });

  test("falls back to workbench-native host capabilities", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const renderer = createBridgeWebviewRenderer();

    const element = renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined }) as {
      props: { capabilities: HostCapabilityRegistry };
    };

    expect(typeof element.props.capabilities["commands.execute"]).toBe("function");
    expect(typeof element.props.capabilities["resource.open"]).toBe("function");
  });

  test("uses the injected createProps factory", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const renderer = createBridgeWebviewRenderer({
      createProps: (context) => ({ marker: "custom", webviewId: context.webviewId }),
    });

    const element = renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined }) as {
      props: { props: unknown };
    };

    expect(element.props.props).toEqual({ marker: "custom", webviewId: "lab.page" });
  });

  test("uses the injected createTheme factory", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const renderer = createBridgeWebviewRenderer({
      createTheme: () => "dark",
    });

    const element = renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined }) as {
      props: { theme: unknown };
    };

    expect(element.props.theme).toBe("dark");
  });

  test("falls back to placement-derived props", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const renderer = createBridgeWebviewRenderer();

    const element = renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined }) as {
      props: { props: unknown };
    };

    expect(element.props.props).toEqual({ placement, resource: placement.resource });
  });

  test("passes bridge config from the widget into the extension frame", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const renderer = createBridgeWebviewRenderer();

    const element = renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined }) as {
      props: { view: { webview: unknown } };
    };

    expect(element.props.view.webview).toEqual({
      capabilities: ["commands.execute"],
      moduleUrl: "https://host/module.js",
      runtimeUrl: "https://host/runtime.html",
      styles: [],
    });
  });

  test("keeps one host event publisher for the same rendered webview instance", () => {
    const { workbench, widget, placement } = setupWebviewWidget();
    const hostEvents: unknown[] = [];
    const renderer = createBridgeWebviewRenderer({
      createHostCapabilities: (context) => {
        hostEvents.push(context.hostEvents);
        return {};
      },
    });

    renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined });
    renderer.render({ workbench, panel: widget, instance: placement, refresh: () => undefined });

    expect(hostEvents).toHaveLength(2);
    expect(hostEvents[1]).toBe(hostEvents[0]);
  });
});
