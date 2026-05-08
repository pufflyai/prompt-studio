/**
 * Bridge runtime served to extension webview iframes.
 *
 * The body starts transparent so the host's background paints through until the lab
 * module mounts — no white flash regardless of host theme. A rimless guest connection
 * waits for `init` from the host, applies theme variables synchronously to <html>, then
 * dynamically imports the extension's bundled module and calls `view.mount(...)`.
 *
 * Theme variables, props, and the module URL all flow through the rimless `init` payload,
 * so the iframe never depends on URL query params or one-shot postMessage envelopes.
 */
const RUNTIME_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        height: 100%;
        margin: 0;
        background: transparent;
      }
      #pstdio-extension-mount {
        height: 100%;
        width: 100%;
        display: block;
        min-height: 0;
      }
    </style>
  </head>
  <body>
    <div id="pstdio-extension-mount"></div>
    <script type="module">
      import { guest } from "https://esm.sh/rimless@0.7.1";

      const MOUNT_ID = "pstdio-extension-mount";

      const applyTheme = (theme, variables) => {
        const docEl = document.documentElement;
        if (theme) {
          const opposite = theme === "dark" ? "light" : "dark";
          docEl.classList.remove(opposite);
          docEl.classList.add(theme);
          docEl.setAttribute("data-theme", theme);
          docEl.style.colorScheme = theme;
        }
        for (const [name, value] of Object.entries(variables ?? {})) {
          if (name.startsWith("--")) docEl.style.setProperty(name, value);
        }
      };

      const injectStyles = (urls) => {
        for (const url of urls ?? []) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = url;
          document.head.appendChild(link);
        }
      };

      const ensureMount = () => {
        let el = document.getElementById(MOUNT_ID);
        if (!el) {
          el = document.createElement("div");
          el.id = MOUNT_ID;
          document.body.appendChild(el);
        }
        return el;
      };

      const propsStore = (() => {
        let value;
        const listeners = new Set();
        return {
          get: () => value,
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          set: (next) => {
            value = next;
            for (const listener of listeners) listener(value);
          },
        };
      })();

      let cleanup;
      let connection;

      // Generic keyboard forwarder: relays any modified keypress (Cmd/Ctrl/Alt) up to the
      // host so dashboard-level shortcuts work uniformly whether focus is in the iframe or
      // the host page. The guest is intentionally agnostic about which shortcuts the host
      // owns — it just hands events over.
      const installKeyboardForwarder = () => {
        document.addEventListener(
          "keydown",
          (event) => {
            if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
            // Skip while typing inside form fields where the user is composing a value.
            const target = event.target;
            const isFormField =
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement ||
              target instanceof HTMLSelectElement ||
              (target instanceof HTMLElement && target.isContentEditable);
            if (isFormField && !event.shiftKey) {
              // Allow plain Cmd+C/V/X/A and similar single-modifier shortcuts to work
              // natively inside form fields. Forward chord shortcuts (Cmd+Shift+...).
              return;
            }
            connection.remote
              .call({
                method: "host.dispatchKeyboardEvent",
                params: {
                  key: event.key,
                  code: event.code,
                  ctrlKey: event.ctrlKey,
                  metaKey: event.metaKey,
                  altKey: event.altKey,
                  shiftKey: event.shiftKey,
                  repeat: event.repeat,
                },
              })
              .catch(() => {});
          },
          true,
        );
      };

      const hostApi = {
        init: async ({ moduleUrl, styles, props, theme, themeVariables }) => {
          try {
            applyTheme(theme, themeVariables);
            injectStyles(styles);
            propsStore.set(props);
            const mod = await import(moduleUrl);
            const view = mod.default ?? (mod.mount ? mod : null);
            if (!view?.mount) {
              throw new Error("Extension module does not export a default view (defineExtensionView).");
            }
            const host = { call: (method, params) => connection.remote.call({ method, params }) };
            const result = await view.mount(ensureMount(), host, propsStore);
            cleanup = typeof result === "function" ? result : undefined;
            installKeyboardForwarder();
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            connection.remote.runtimeError({ message: err.message, stack: err.stack });
            throw err;
          }
        },
        themeUpdate: ({ theme, variables }) => applyTheme(theme, variables),
        propsUpdate: ({ props }) => propsStore.set(props),
      };

      connection = await guest.connect(hostApi);
      connection.remote.ready({});

      window.addEventListener("beforeunload", () => cleanup?.());
    </script>
  </body>
</html>
`;

export const EXTENSION_RUNTIME_PATH = "/extensions/runtime";

export const renderExtensionRuntimeHtml = () => RUNTIME_HTML;
