import { describe, expect, test } from "bun:test";
import { webviewOriginLabel } from "pstdio/runtime";
import { attributeProcess, type OwnedFrame } from "./process-attribution";

const origin = "http://127.0.0.1:43123";
// Each extension's webviews run on their own `<label>.localhost` host at the runtime port.
const webview = (installedExtensionId: string, webviewId: string, host = webviewOriginLabel(installedExtensionId)) =>
  `http://${host}.localhost:43123/v1/extensions/webviews/secret-capability/${installedExtensionId}/${webviewId}/runtime`;

const frames: OwnedFrame[] = [
  { owner: "startup", isMainFrame: true, osProcessId: 10, url: "pstdio://lifecycle/index.html" },
  { owner: "workbench", isMainFrame: true, osProcessId: 11, url: `${origin}/projects/one` },
  { owner: "workbench", isMainFrame: false, osProcessId: 11, url: `${origin}/artifact-preview` },
  { owner: "workbench", isMainFrame: false, osProcessId: 12, url: webview("installed-lab", "lab") },
  { owner: "workbench", isMainFrame: false, osProcessId: 12, url: webview("installed-shader", "shader") },
  { owner: "workbench", isMainFrame: false, osProcessId: 12, url: webview("installed-lab", "lab") },
  {
    owner: "workbench",
    isMainFrame: false,
    osProcessId: 13,
    url: "https://example.com/v1/extensions/webviews/c/fake/view/runtime",
  },
];

describe("process attribution", () => {
  test("names the app, GPU, and utility processes from their Chromium type", () => {
    expect(attributeProcess({ pid: 1, type: "Browser" }, frames, origin)).toEqual({
      role: "main",
      name: null,
      extensionFrames: [],
    });
    expect(attributeProcess({ pid: 2, type: "GPU", serviceName: "GPU" }, frames, origin).role).toBe("gpu");
    expect(attributeProcess({ pid: 3, type: "Utility", name: "Network Service" }, frames, origin)).toEqual({
      role: "utility",
      name: "Network Service",
      extensionFrames: [],
    });
  });

  test("names a renderer after the owned window whose main frame it hosts", () => {
    expect(attributeProcess({ pid: 10, type: "Tab" }, frames, origin).role).toBe("startup");
    expect(attributeProcess({ pid: 11, type: "Tab" }, frames, origin)).toEqual({
      role: "workbench",
      name: null,
      extensionFrames: [],
    });
  });

  test("lists every extension webview that shares one renderer without exposing the capability", () => {
    const attribution = attributeProcess({ pid: 12, type: "Tab" }, frames, origin);

    expect(attribution).toEqual({
      role: "extension-frames",
      name: null,
      extensionFrames: [
        { installedExtensionId: "installed-lab", webviewId: "lab" },
        { installedExtensionId: "installed-shader", webviewId: "shader" },
      ],
    });
    expect(JSON.stringify(attribution)).not.toContain("secret-capability");
  });

  test("leaves renderers unattributed when no owned runtime frame proves their owner", () => {
    expect(attributeProcess({ pid: 13, type: "Tab" }, frames, origin)).toEqual({
      role: "renderer",
      name: null,
      extensionFrames: [],
    });
    expect(attributeProcess({ pid: 12, type: "Tab" }, frames, null).role).toBe("renderer");
  });

  test("ignores a frame whose host does not belong to the extension named in its path", () => {
    const spoofed: OwnedFrame[] = [
      { owner: "workbench", isMainFrame: false, osProcessId: 20, url: webview("shader", "main") },
      // Shader Lab's page loads a decoy frame on its own host that names another extension.
      {
        owner: "workbench",
        isMainFrame: false,
        osProcessId: 20,
        url: webview("decoy", "main", webviewOriginLabel("shader")),
      },
      {
        owner: "workbench",
        isMainFrame: false,
        osProcessId: 21,
        url: `${origin}/v1/extensions/webviews/c/notes/main/runtime`,
      },
      {
        owner: "workbench",
        isMainFrame: false,
        osProcessId: 22,
        url: webview("notes", "main").replace(":43123/", ":9999/"),
      },
    ];

    expect(attributeProcess({ pid: 20, type: "Tab" }, spoofed, origin).extensionFrames).toEqual([
      { installedExtensionId: "shader", webviewId: "main" },
    ]);
    expect(attributeProcess({ pid: 21, type: "Tab" }, spoofed, origin).extensionFrames).toEqual([]);
    expect(attributeProcess({ pid: 22, type: "Tab" }, spoofed, origin).extensionFrames).toEqual([]);
  });
});
