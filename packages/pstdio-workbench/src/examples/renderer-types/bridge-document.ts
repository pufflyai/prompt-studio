import { renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";
import { openReactCommandId } from "./data";

export interface BridgeDocumentAssets {
  moduleUrl: string;
  runtimeUrl: string;
  dispose: () => void;
}

export interface CreateBridgeDocumentInput {
  runtimeScript: string;
}

export const bridgeWebviewCapabilities = ["commands.execute", "notification.show"] as const;

const createObjectUrl = (source: string, type: string) => URL.createObjectURL(new Blob([source], { type }));

const createModuleDataUrl = (source: string) => `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;

const escapeScriptJson = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

const createBridgeModuleScript = () => `const openReactCommandId = ${escapeScriptJson(openReactCommandId)};

const viewHtml = \`
  <main>
    <header>
      <h1>Bridge renderer</h1>
      <p>Iframe surface owned by the packaged extension bridge.</p>
    </header>
    <section aria-label="Bridge payload">
      <pre id="payload"></pre>
    </section>
    <footer>
      <button type="button" data-action="notify">Notify host</button>
      <button type="button" class="secondary" data-action="openReact">Open React renderer</button>
    </footer>
  </main>
\`;

const styles = \`
  :root {
    color-scheme: light dark;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  body {
    background: var(--chakra-colors-bg-subtle, #f8fafc);
    color: var(--chakra-colors-fg, #1f2937);
    height: 100vh;
    margin: 0;
  }

  main {
    box-sizing: border-box;
    display: grid;
    gap: 16px;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    padding: 24px;
  }

  header,
  section {
    background: var(--chakra-colors-bg-panel, #ffffff);
    border: 1px solid var(--chakra-colors-border-subtle, #d8dee8);
    border-radius: 6px;
  }

  header {
    display: grid;
    gap: 8px;
    padding: 16px;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    font-size: 18px;
    font-weight: 650;
  }

  p {
    color: var(--chakra-colors-fg-muted, #64748b);
    font-size: 13px;
    line-height: 1.5;
  }

  section {
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  pre {
    color: var(--chakra-colors-fg, #334155);
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  button {
    align-items: center;
    background: var(--chakra-colors-fg, #1f2937);
    border: 0;
    color: var(--chakra-colors-bg, #ffffff);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    font-size: 13px;
    min-height: 32px;
    padding: 0 12px;
  }

  button.secondary {
    background: var(--chakra-colors-bg-muted, #e0f2fe);
    color: var(--chakra-colors-fg, #0f172a);
  }
\`;

const renderPayload = (mount, props) => {
  mount.querySelector("#payload").textContent = JSON.stringify(props ?? null, null, 2);
};

export default {
  mount(mount, host, propsStore) {
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.appendChild(style);
    mount.innerHTML = viewHtml;
    renderPayload(mount, propsStore.get());

    const unsubscribe = propsStore.subscribe((props) => renderPayload(mount, props));
    const handleClick = (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      if (button.dataset.action === "notify") {
        void host.call("notification.show", {
          level: "info",
          title: "Bridge renderer",
          message: "The iframe bridge invoked a host notification.",
        });
        return;
      }

      void host.call("commands.execute", { commandId: openReactCommandId });
    };

    mount.addEventListener("click", handleClick);

    return () => {
      unsubscribe();
      mount.removeEventListener("click", handleClick);
      mount.replaceChildren();
      style.remove();
    };
  },
};
`;

export const createBridgeDocument = (input: CreateBridgeDocumentInput): BridgeDocumentAssets => {
  const runtimeUrl = createObjectUrl(renderInlineExtensionRuntimeHtml(input.runtimeScript), "text/html");
  const moduleUrl = createModuleDataUrl(createBridgeModuleScript());

  return {
    moduleUrl,
    runtimeUrl,
    dispose: () => {
      URL.revokeObjectURL(runtimeUrl);
    },
  };
};
