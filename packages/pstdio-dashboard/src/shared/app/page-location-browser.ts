import type { WorkbenchPageLocationBrowser } from "@pstdio/workbench";

interface DashboardPageLocationWindow {
  location: { pathname: string; search: string };
  history: {
    readonly state: unknown;
    pushState(state: unknown, unused: string, url: string): void;
    replaceState(state: unknown, unused: string, url: string): void;
    back(): void;
    forward(): void;
  };
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

export const createDashboardPageLocationBrowser = (
  browserWindow: DashboardPageLocationWindow,
): WorkbenchPageLocationBrowser => {
  const current = () => ({
    url: `${browserWindow.location.pathname}${browserWindow.location.search}`,
    state: browserWindow.history.state,
  });

  return {
    current,
    push: (entry) => browserWindow.history.pushState(entry.state, "", entry.url),
    replace: (entry) => browserWindow.history.replaceState(entry.state, "", entry.url),
    back: () => browserWindow.history.back(),
    forward: () => browserWindow.history.forward(),
    onPopState: (listener) => {
      const handlePopState = () => listener(current());
      browserWindow.addEventListener("popstate", handlePopState);
      return {
        dispose: () => browserWindow.removeEventListener("popstate", handlePopState),
      };
    },
  };
};
