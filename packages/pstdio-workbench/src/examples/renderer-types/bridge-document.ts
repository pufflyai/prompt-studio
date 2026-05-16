import { bridgeActionMessageType } from "./data";

export interface BridgeActionMessage {
  type: typeof bridgeActionMessageType;
  action: "notify" | "openReact";
}

export const isBridgeActionMessage = (value: unknown): value is BridgeActionMessage =>
  typeof value === "object" &&
  value !== null &&
  (value as BridgeActionMessage).type === bridgeActionMessageType &&
  ((value as BridgeActionMessage).action === "notify" || (value as BridgeActionMessage).action === "openReact");

const escapeScriptJson = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

export const createBridgeDocument = (payload: unknown) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      body {
        background: #f8fafc;
        color: #1f2937;
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
        border: 1px solid #d8dee8;
        border-radius: 6px;
        background: #ffffff;
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
        color: #64748b;
        font-size: 13px;
        line-height: 1.5;
      }

      section {
        min-height: 0;
        overflow: auto;
        padding: 16px;
      }

      pre {
        color: #334155;
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
        background: #1f2937;
        border: 0;
        border-radius: 6px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 13px;
        min-height: 32px;
        padding: 0 12px;
      }

      button.secondary {
        background: #e0f2fe;
        color: #0f172a;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Bridge renderer</h1>
        <p>Iframe surface owned by a registered workbench renderer.</p>
      </header>
      <section aria-label="Bridge payload">
        <pre id="payload"></pre>
      </section>
      <footer>
        <button type="button" data-action="notify">Notify host</button>
        <button type="button" class="secondary" data-action="openReact">Open React renderer</button>
      </footer>
    </main>
    <script>
      const payload = ${escapeScriptJson(payload)};
      document.getElementById("payload").textContent = JSON.stringify(payload, null, 2);
      document.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        parent.postMessage(
          {
            type: "${bridgeActionMessageType}",
            action: button.dataset.action,
          },
          "*",
        );
      });
    </script>
  </body>
</html>`;
