import { guest } from "rimless";
import type { HostApi, HostEventMessage, InitMessage, PropsUpdateMessage, ThemeUpdateMessage } from "../contract";
import { normalizeRuntimeError } from "../normalize-error";
import { createGuestHost, createPropsStore, type ExtensionViewModule } from "./define-extension-view";
import { createViewLifecycle } from "./view-lifecycle";

const MOUNT_ID = "pstdio-extension-mount";

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

const installOpaqueOriginStorageFallbacks = () => {
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      void window[storageName];
    } catch {
      Object.defineProperty(window, storageName, {
        configurable: true,
        value: createMemoryStorage(),
      });
    }
  }
};

const applyTheme = (theme: string, variables: Record<string, string>) => {
  const docEl = document.documentElement;
  const opposite = theme === "dark" ? "light" : "dark";
  docEl.classList.remove(opposite);
  docEl.classList.add(theme);
  docEl.setAttribute("data-theme", theme);
  docEl.style.colorScheme = theme;

  for (const [name, value] of Object.entries(variables)) {
    if (name.startsWith("--")) docEl.style.setProperty(name, value);
  }
};

const injectStyles = (urls: string[]) => {
  for (const url of urls) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }
};

const ensureMount = () => {
  let element = document.getElementById(MOUNT_ID);
  if (!element) {
    element = document.createElement("div");
    element.id = MOUNT_ID;
    element.style.height = "100%";
    element.style.width = "100%";
    document.body.appendChild(element);
  }
  return element;
};

// The rimless guest accepts a handshake and calls from any window, so a sibling or nested frame
// could mount its own module with this webview's host capabilities. Only the host page that embeds
// this frame may use the bridge. The window identity is the check: this opaque-origin frame has no
// trusted copy of the host origin, and only the host page can post with `source === window.parent`.
const acceptBridgeMessagesOnlyFromHost = () => {
  window.addEventListener(
    "message",
    (event) => {
      const action = (event.data as { action?: unknown } | null)?.action;
      if (typeof action !== "string" || !action.startsWith("RIMLESS/")) return;
      if (event.source !== window.parent) event.stopImmediatePropagation();
    },
    { capture: true },
  );
};

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const start = async () => {
  installOpaqueOriginStorageFallbacks();
  acceptBridgeMessagesOnlyFromHost();

  const propsStore = createPropsStore<unknown>(undefined);
  const hostEventListeners = new Map<string, Set<(payload: unknown) => void>>();
  const subscribeHostEvent = (scope: string, handler: (payload: unknown) => void) => {
    const handlers = hostEventListeners.get(scope) ?? new Set();
    handlers.add(handler);
    hostEventListeners.set(scope, handlers);
    return () => {
      handlers.delete(handler);
    };
  };
  const viewLifecycle = createViewLifecycle(async (message: InitMessage) => {
    injectStyles(message.styles);
    const module = (await import(/* @vite-ignore */ message.moduleUrl)) as {
      default?: ExtensionViewModule;
    } & Partial<ExtensionViewModule>;
    const view = module.default ?? (module.mount ? (module as ExtensionViewModule) : undefined);
    if (!view?.mount) throw new Error("Extension module does not export a default view (defineExtensionView).");

    const host = createGuestHost((request) => connection.remote.call(request), subscribeHostEvent, message.extensionId);
    return await view.mount(ensureMount(), host, propsStore);
  });
  let keyboardForwarderInstalled = false;

  const connection = await guest.connect({
    init: async (message: InitMessage) => {
      try {
        applyTheme(message.theme, message.themeVariables);
        propsStore.set(message.props);
        await viewLifecycle.initialize(message);

        if (!keyboardForwarderInstalled) {
          keyboardForwarderInstalled = true;
          document.addEventListener(
            "keydown",
            (event) => {
              if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
              if (isEditableTarget(event.target) && !event.shiftKey) return;

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
        }
      } catch (error) {
        const payload = normalizeRuntimeError(error);
        connection.remote.runtimeError(payload);
        throw error instanceof Error ? error : new Error(payload.message);
      }
    },
    themeUpdate: (message: ThemeUpdateMessage) => {
      applyTheme(message.theme, message.variables);
    },
    propsUpdate: (message: PropsUpdateMessage) => {
      propsStore.set(message.props);
    },
    hostEvent: (message: HostEventMessage) => {
      for (const handler of hostEventListeners.get(message.scope) ?? []) handler(message.payload);
    },
  } satisfies HostApi);

  connection.remote.ready({});

  window.addEventListener("beforeunload", () => {
    viewLifecycle.dispose();
  });
};

void start();
