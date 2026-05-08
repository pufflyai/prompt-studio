import { guest } from "rimless";
import type { HostApi, InitMessage, PropsUpdateMessage, ThemeUpdateMessage } from "../contract";
import { createGuestHost, createPropsStore, type ExtensionViewModule } from "./define-extension-view";

const MOUNT_ID = "pstdio-extension-mount";

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

const start = async () => {
  const propsStore = createPropsStore<unknown>(undefined);
  let cleanup: (() => void) | undefined;

  const hostApi: HostApi = {
    init: async (message: InitMessage) => {
      try {
        applyTheme(message.theme, message.themeVariables);
        injectStyles(message.styles);
        propsStore.set(message.props);

        const mountEl = ensureMount();
        const module = (await import(/* @vite-ignore */ message.moduleUrl)) as {
          default?: ExtensionViewModule;
        } & Partial<ExtensionViewModule>;
        const view: ExtensionViewModule | undefined =
          module.default ?? (module.mount ? (module as ExtensionViewModule) : undefined);
        if (!view?.mount) throw new Error("Extension module does not export a default view (defineExtensionView).");

        const host = createGuestHost((request) => connection.remote.call(request));
        const result = await view.mount(mountEl, host, propsStore);
        cleanup = typeof result === "function" ? result : undefined;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        connection.remote.runtimeError({ message: err.message, stack: err.stack });
        throw err;
      }
    },
    themeUpdate: (message: ThemeUpdateMessage) => {
      applyTheme(message.theme, message.variables);
    },
    propsUpdate: (message: PropsUpdateMessage) => {
      propsStore.set(message.props);
    },
  };

  const connection = await guest.connect(hostApi);
  connection.remote.ready({});

  window.addEventListener("beforeunload", () => {
    cleanup?.();
  });
};

void start();
