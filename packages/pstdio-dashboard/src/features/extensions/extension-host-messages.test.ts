import { describe, expect, it } from "bun:test";
import { buildExtensionThemeMessage, readExtensionHostMessage } from "./extension-host-messages";

describe("extension host messages", () => {
  it("reads an open command palette request from a guest webview", () => {
    expect(readExtensionHostMessage({ type: "pstdio.extension.openCommandPalette" })).toEqual({
      type: "open-command-palette",
    });
  });

  it("reads a theme preference request from a guest webview", () => {
    expect(
      readExtensionHostMessage({
        type: "pstdio.extension.setThemePreference",
        themePreference: "pstdio-dark",
      }),
    ).toEqual({ type: "set-theme-preference", themePreference: "pstdio-dark" });
  });

  it("reads a toast request from a guest webview", () => {
    expect(
      readExtensionHostMessage({
        type: "pstdio.extension.showToast",
        toast: { type: "info", title: "Lab", description: "Hello from the lab" },
      }),
    ).toEqual({
      type: "show-toast",
      toast: { type: "info", title: "Lab", description: "Hello from the lab" },
    });
  });

  it("ignores malformed guest messages", () => {
    expect(readExtensionHostMessage(null)).toBeNull();
    expect(readExtensionHostMessage({ type: "pstdio.extension.setThemePreference" })).toBeNull();
    expect(
      readExtensionHostMessage({
        type: "pstdio.extension.showToast",
        toast: { type: "debug", description: "Hello" },
      }),
    ).toBeNull();
  });

  it("builds a host theme message for guest webviews", () => {
    expect(buildExtensionThemeMessage("pstdio-dark")).toEqual({
      type: "pstdio.host.themePreference",
      themePreference: "pstdio-dark",
    });
  });
});
