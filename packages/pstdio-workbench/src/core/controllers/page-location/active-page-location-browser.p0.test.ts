import { expect, test } from "bun:test";
import { createWorkbenchActivation } from "../../workbench-activation";
import { createActivePageLocationBrowser } from "./active-page-location-browser";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";
import type { WorkbenchPageBrowserEntry } from "./page-location-types";

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
