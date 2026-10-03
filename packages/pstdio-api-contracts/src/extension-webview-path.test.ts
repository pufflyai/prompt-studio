import { describe, expect, test } from "bun:test";
import { parseExtensionWebviewPath } from "./extension-webview-path";

describe("extension webview path", () => {
  test("names the capability, installed extension, webview, and resource", () => {
    expect(
      parseExtensionWebviewPath("/v1/extensions/webviews/cap/installed%20lab/lab.page/assets/chunks/view.js"),
    ).toEqual({
      capability: "cap",
      resource: "assets",
      rest: ["chunks", "view.js"],
      scope: { installedExtensionId: "installed lab", webviewId: "lab.page" },
    });
  });

  test("rejects paths outside the webview routes or with missing segments", () => {
    expect(parseExtensionWebviewPath("/v1/projects/cap/installed/lab/runtime")).toBeNull();
    expect(parseExtensionWebviewPath("/v1/extensions/webviews/cap/installed")).toBeNull();
    expect(parseExtensionWebviewPath("/v1/extensions/webviews/cap/%E0%A4%A/lab/runtime")).toBeNull();
  });
});
