import { describe, expect, test } from "bun:test";
import { createDashboardPageLocationBrowser } from "./page-location-browser";

const createBrowserWindow = () => {
  const listeners = new Set<() => void>();
  const location = { pathname: "/projects/project-1", search: "" };
  let state: unknown;
  const writes: Array<{ kind: "push" | "replace"; state: unknown; url: string }> = [];
  return {
    window: {
      location,
      history: {
        get state() {
          return state;
        },
        pushState(nextState: unknown, _unused: string, url: string) {
          state = nextState;
          writes.push({ kind: "push", state: nextState, url });
        },
        replaceState(nextState: unknown, _unused: string, url: string) {
          state = nextState;
          writes.push({ kind: "replace", state: nextState, url });
        },
      },
      addEventListener(_type: "popstate", listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_type: "popstate", listener: () => void) {
        listeners.delete(listener);
      },
    },
    writes,
    pop(url: string, nextState: unknown) {
      const parsed = new URL(url, "http://dashboard.test");
      location.pathname = parsed.pathname;
      location.search = parsed.search;
      state = nextState;
      for (const listener of listeners) listener();
    },
  };
};

describe("dashboard page location browser", () => {
  test("reads and writes browser history and publishes popstate entries", () => {
    const harness = createBrowserWindow();
    const browser = createDashboardPageLocationBrowser(harness.window);
    const popped: unknown[] = [];
    const subscription = browser.onPopState((entry) => popped.push(entry));

    browser.push({ url: "/projects/project-1/extensions/pstdio.extension-lab/lab", state: { page: "lab" } });
    browser.replace({ url: "/projects/project-1", state: { page: "start" } });
    harness.pop("/projects/project-1/extensions/pstdio.extension-lab/lab?section=one", { page: "lab" });

    expect(harness.writes).toEqual([
      {
        kind: "push",
        state: { page: "lab" },
        url: "/projects/project-1/extensions/pstdio.extension-lab/lab",
      },
      { kind: "replace", state: { page: "start" }, url: "/projects/project-1" },
    ]);
    expect(popped).toEqual([
      {
        state: { page: "lab" },
        url: "/projects/project-1/extensions/pstdio.extension-lab/lab?section=one",
      },
    ]);

    subscription.dispose();
    expect(browser.current()).toEqual({
      state: { page: "lab" },
      url: "/projects/project-1/extensions/pstdio.extension-lab/lab?section=one",
    });
  });
});
