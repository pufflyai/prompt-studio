import { describe, expect, test } from "bun:test";
import { createWebviewRegistry } from "./webview-registry";

describe("createWebviewRegistry", () => {
  test("registers webviews with explicit capabilities", () => {
    const webviews = createWebviewRegistry();

    webviews.registerWebview(
      {
        id: "extension-lab.labPage",
        title: "Extension Lab",
        entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension-lab" },
        capabilities: ["commands.execute", "resource.open"],
      },
      { source: "extension", ownerId: "pstdio.extension-lab" },
    );

    expect(webviews.getWebview("extension-lab.labPage")).toMatchObject({
      id: "extension-lab.labPage",
      source: "extension",
      capabilities: ["commands.execute", "resource.open"],
    });
  });
});
