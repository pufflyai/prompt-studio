import { describe, expect, test } from "bun:test";
import { createViewVisibility } from "./view-visibility";

describe("webview visibility", () => {
  test("combines panel and browser visibility and signals changes", () => {
    let browserHidden = false;
    const doc = Object.assign(new EventTarget(), {
      get hidden() {
        return browserHidden;
      },
      get visibilityState() {
        return browserHidden ? "hidden" : "visible";
      },
    });
    // Preserve real getters, just as a browser document does.
    Object.defineProperties(doc, {
      hidden: { configurable: true, get: () => browserHidden },
      visibilityState: { configurable: true, get: () => (browserHidden ? "hidden" : "visible") },
    });
    const changes: boolean[] = [];
    doc.addEventListener("visibilitychange", () => changes.push(doc.hidden));
    const visibility = createViewVisibility(doc as Document);
    visibility.setVisible(false);
    expect(doc.hidden).toBe(true);
    expect(doc.visibilityState).toBe("hidden");
    visibility.setVisible(false);
    visibility.setVisible(true);
    expect(doc.hidden).toBe(false);
    expect(changes).toEqual([true, false]);
    browserHidden = true;
    visibility.setVisible(false);
    visibility.setVisible(true);
    expect(doc.hidden).toBe(true);
    expect(doc.visibilityState).toBe("hidden");
    expect(changes).toEqual([true, false]);
  });
});
