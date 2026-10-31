import { expect, test } from "bun:test";
import { createWorkbenchActivation } from "../../workbench-activation";
import { createActivePageLocationBrowser } from "./active-page-location-browser";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";
import type { WorkbenchPageBrowserEntry } from "./page-location-types";

test("shared history replays stamped entries across reloads", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const original = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const hidden = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  original.browser.push({ url: "/a/start", state: { page: "start" } });
  original.browser.push({ url: "/a/editor", state: { page: "editor" } });
  original.dispose();
  hidden.dispose();

  const reloaded = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const inactive = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  const received: WorkbenchPageBrowserEntry[] = [];
  reloaded.browser.onPopState((entry) => received.push(entry));
  try {
    memory.back();
    expect(reloaded.browser.current()).toEqual({ url: "/a/start", state: { page: "start" } });
    memory.forward();
    expect(reloaded.browser.current()).toEqual({ url: "/a/editor", state: { page: "editor" } });
    expect(received).toEqual([
      { url: "/a/start", state: { page: "start" } },
      { url: "/a/editor", state: { page: "editor" } },
    ]);
    expect(inactive.browser.current()).toEqual({ url: "/a/editor", state: { page: "editor" } });
  } finally {
    reloaded.dispose();
    inactive.dispose();
  }
});

test.each(["unchanged", "unknown"])("shared history ignores %s native positions", (position) => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  let emit: ((entry: WorkbenchPageBrowserEntry) => void) | undefined;
  const browser = {
    ...memory,
    onPopState(listener: (entry: WorkbenchPageBrowserEntry) => void) {
      emit = listener;
      return memory.onPopState(listener);
    },
  };
  const a = createActivePageLocationBrowser(browser, createWorkbenchActivation());
  const b = createActivePageLocationBrowser(browser, createWorkbenchActivation(false));
  try {
    a.browser.push({ url: "/a/start" });
    a.browser.push({ url: "/a/editor" });
    const native = position === "unchanged" ? memory.current() : { url: "/outside", state: null };
    memory.replace(native);
    emit!(native);
    expect(a.browser.current().url).toBe("/a/editor");
    expect(memory.current()).toEqual(native);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("shared history traverses new entries after returning to pre-reload history", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const original = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const hidden = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  original.browser.push({ url: "/a/start" });
  original.browser.push({ url: "/a/editor" });
  original.dispose();
  hidden.dispose();

  const reloaded = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const inactive = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  try {
    reloaded.browser.push({ url: "/a/new" });
    memory.back();
    expect(reloaded.browser.current().url).toBe("/a/editor");
    memory.back();
    expect(reloaded.browser.current().url).toBe("/a/start");
    memory.forward();
    expect(reloaded.browser.current().url).toBe("/a/editor");
    memory.forward();
    expect(reloaded.browser.current().url).toBe("/a/new");

    memory.back();
    memory.back();
    reloaded.browser.replace({ url: "/a/replaced" });
    reloaded.browser.push({ url: "/a/next" });
    memory.back();
    expect(reloaded.browser.current().url).toBe("/a/replaced");
    memory.forward();
    expect(reloaded.browser.current().url).toBe("/a/next");
  } finally {
    reloaded.dispose();
    inactive.dispose();
  }
});
