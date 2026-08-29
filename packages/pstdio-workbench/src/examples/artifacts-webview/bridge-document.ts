import { renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";

export interface ArtifactsBridgeDocumentAssets {
  moduleUrl: string;
  runtimeUrl: string;
  dispose: () => void;
}

export interface CreateArtifactsBridgeDocumentInput {
  runtimeScript: string;
}

// One grant per mount: the webview may read "runs" and nothing else. The
// "secrets" button exists to show the gate denying an undeclared mount.
export const artifactsWebviewCapabilities = ["artifacts.read:runs"] as const;

const createObjectUrl = (source: string, type: string) => URL.createObjectURL(new Blob([source], { type }));

const createModuleDataUrl = (source: string) => `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;

const createArtifactsModuleScript = () => `const viewHtml = \`
  <main>
    <header>
      <h1>Artifact reads</h1>
      <p>This webview declared <code>artifacts.read:runs</code>. Every read below goes through the capability gate.</p>
    </header>
    <section aria-label="Artifact output">
      <img id="chart" alt="chart artifact" hidden />
      <pre id="output">Pick an action below.</pre>
    </section>
    <footer>
      <button type="button" data-action="list">List runs/a/</button>
      <button type="button" data-action="summary">Read summary.json</button>
      <button type="button" data-action="chart">Show chart.png</button>
      <button type="button" class="secondary" data-action="secrets">Read undeclared mount</button>
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
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  img {
    border: 1px solid var(--chakra-colors-border-subtle, #d8dee8);
    height: 80px;
    image-rendering: pixelated;
    justify-self: start;
    width: 120px;
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
    background: var(--chakra-colors-bg-muted, #fee2e2);
    color: var(--chakra-colors-fg, #0f172a);
  }
\`;

const show = (mount, value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  mount.querySelector("#output").textContent = text;
};

const actions = {
  list: async (mount, host) => {
    show(mount, await host.call("artifacts.read", { op: "list", mount: "runs", prefix: "a/" }));
  },
  summary: async (mount, host) => {
    show(mount, await host.call("artifacts.read", { op: "readText", mount: "runs", path: "a/summary.json" }));
  },
  chart: async (mount, host) => {
    const url = await host.call("artifacts.read", { op: "imageUrl", mount: "runs", path: "a/chart.png" });
    const image = mount.querySelector("#chart");
    image.src = url;
    image.hidden = false;
    show(mount, "Image URL: " + url);
  },
  secrets: async (mount, host) => {
    await host.call("artifacts.read", { op: "readText", mount: "secrets", path: "s.txt" });
  },
};

export default {
  mount(mount, host) {
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.appendChild(style);
    mount.innerHTML = viewHtml;

    const handleClick = async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      try {
        await actions[button.dataset.action](mount, host);
      } catch (error) {
        show(mount, "Denied: " + (error instanceof Error ? error.message : String(error)));
      }
    };

    mount.addEventListener("click", handleClick);

    return () => {
      mount.removeEventListener("click", handleClick);
      mount.replaceChildren();
      style.remove();
    };
  },
};
`;

export const createArtifactsBridgeDocument = (
  input: CreateArtifactsBridgeDocumentInput,
): ArtifactsBridgeDocumentAssets => {
  const runtimeUrl = createObjectUrl(renderInlineExtensionRuntimeHtml(input.runtimeScript), "text/html");
  const moduleUrl = createModuleDataUrl(createArtifactsModuleScript());

  return {
    moduleUrl,
    runtimeUrl,
    dispose: () => {
      URL.revokeObjectURL(runtimeUrl);
    },
  };
};
