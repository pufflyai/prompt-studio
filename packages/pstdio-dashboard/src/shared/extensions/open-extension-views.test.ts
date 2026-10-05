import { describe, expect, test } from "bun:test";
import { openExtensionViews } from "./open-extension-views";

describe("open extension views", () => {
  test("counts each webview once while any of its frames is mounted", () => {
    const closeFirst = openExtensionViews.open("notes", "editor");
    const closeSecond = openExtensionViews.open("notes", "editor");
    const closeList = openExtensionViews.open("notes", "list");
    expect(openExtensionViews.get().get("notes")).toBe(2);

    closeFirst();
    expect(openExtensionViews.get().get("notes")).toBe(2);
    closeSecond();
    closeList();
    expect(openExtensionViews.get().has("notes")).toBe(false);
  });
});
