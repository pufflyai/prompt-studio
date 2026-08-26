import { describe, expect, test } from "bun:test";
import { toBridgeWebviewConfig } from "./webview-contribution-config";

describe("toBridgeWebviewConfig", () => {
  test("leaves the title undefined when the webview has no title", () => {
    const config = toBridgeWebviewConfig({
      entry: { kind: "package-asset", path: "./view.tsx", baseUrl: "file:///extension/" },
      runtimeUrl: "https://host/runtime.html",
      moduleUrl: "https://host/module.js",
    });

    expect(config.title).toBeUndefined();
  });

  test("leaves a blank title undefined so the owning view supplies the frame label", () => {
    const config = toBridgeWebviewConfig({
      entry: { kind: "package-asset", path: "./view.tsx", baseUrl: "file:///extension/" },
      title: "",
      runtimeUrl: "https://host/runtime.html",
      moduleUrl: "https://host/module.js",
    });

    expect(config.title).toBeUndefined();
  });
});
