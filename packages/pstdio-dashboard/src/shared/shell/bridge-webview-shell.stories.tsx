import { Toaster } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import runtimeScript from "pstdio-extensions/bridge/runtime.bundle.js?raw";
import { renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/runtime-html";
import { BRIDGE_WEBVIEW_RENDERER_ID, createBridgeWebviewRenderer } from "pstdio-extensions/shell";
import { createShellCore, type ShellCore } from "pstdio-shell/core";
import { ShellWorkbench } from "pstdio-shell/react";
import { useState } from "react";

const toDataUrl = (mimeType: string, content: string) =>
  `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;

const bridgeStoryStyles = `
  body {
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .bridge-story {
    box-sizing: border-box;
    display: grid;
    gap: 16px;
    height: 100%;
    place-content: center;
    padding: 32px;
    text-align: center;
  }

  .bridge-story h1 {
    font-size: 20px;
    margin: 0;
  }

  .bridge-story p {
    color: #5f6673;
    line-height: 1.5;
    margin: 0;
    max-width: 520px;
  }

  .bridge-story button {
    background: #18181b;
    border: 0;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font: inherit;
    justify-self: center;
    padding: 8px 12px;
  }

  .bridge-story pre {
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    color: #3f3f46;
    margin: 0;
    max-width: 560px;
    overflow: auto;
    padding: 12px;
    text-align: left;
  }
`;

const bridgeStoryModule = `
  const formatPlacement = (props) => {
    const placement = props?.placement ?? {};
    return JSON.stringify(
      {
        widgetId: placement.widgetId,
        contributionId: placement.contributionId,
        title: placement.title,
      },
      null,
      2,
    );
  };

  export default {
    mount(element, host, propsStore) {
      element.innerHTML = \`
        <main class="bridge-story">
          <h1>Bridge webview renderer</h1>
          <p>
            This widget is rendered by ShellWorkbench through rendererId: "${BRIDGE_WEBVIEW_RENDERER_ID}".
            The iframe guest receives widget placement props and can call declared host capabilities.
          </p>
          <button type="button">Show host notification</button>
          <pre></pre>
        </main>
      \`;

      const button = element.querySelector("button");
      const output = element.querySelector("pre");
      const renderProps = () => {
        output.textContent = formatPlacement(propsStore.get());
      };
      const showNotification = () => {
        host.call("notification.show", {
          level: "info",
          title: "Bridge webview",
          message: "Notification routed through the bridge host capability.",
        });
      };

      renderProps();
      const unsubscribe = propsStore.subscribe(renderProps);
      button.addEventListener("click", showNotification);

      return () => {
        unsubscribe();
        button.removeEventListener("click", showNotification);
      };
    },
  };
`;

interface BridgeStoryAssets {
  moduleUrl: string;
  runtimeUrl: string;
  styleUrl: string;
}

const createBridgeStoryAssets = (): BridgeStoryAssets => {
  const runtimeScriptUrl = toDataUrl("text/javascript", runtimeScript);
  return {
    moduleUrl: toDataUrl("text/javascript", bridgeStoryModule),
    runtimeUrl: toDataUrl("text/html", renderExtensionRuntimeHtml(runtimeScriptUrl)),
    styleUrl: toDataUrl("text/css", bridgeStoryStyles),
  };
};

const createBridgeStoryShell = (assets: BridgeStoryAssets): ShellCore => {
  const shell = createShellCore();

  shell.renderers.registerRenderer(createBridgeWebviewRenderer());

  shell.layout.registerWidget(
    {
      id: "bridge.story",
      title: "Bridge Story",
      area: "main",
      rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
      config: {
        title: "Bridge Story",
        runtimeUrl: assets.runtimeUrl,
        moduleUrl: assets.moduleUrl,
        styles: [assets.styleUrl],
        capabilities: ["notification.show@1"],
      },
    },
    { source: "extension", ownerId: "storybook.bridge" },
  );

  shell.layout.openWidget("bridge.story", { pinned: true });

  return shell;
};

const BridgeWebviewWorkbench = () => {
  const [shell] = useState(() => createBridgeStoryShell(createBridgeStoryAssets()));

  return (
    <>
      <ShellWorkbench shell={shell} />
      <Toaster />
    </>
  );
};

const meta = {
  title: "Extensions/Bridge Webview Shell",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const WorkbenchWidget: Story = {
  render: () => <BridgeWebviewWorkbench />,
};
