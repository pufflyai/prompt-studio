import { describe, expect, test } from "bun:test";
import {
  CONTENT_SECURITY_POLICY,
  createSecureWindowOptions,
  decideNavigation,
  isAllowedExternalUrl,
} from "./window-security";

describe("desktop window security", () => {
  test("uses the hardened BrowserWindow baseline and an ephemeral partition", () => {
    const options = createSecureWindowOptions("/app/preload.cjs", "pstdio-workbench");

    expect(options.webPreferences).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      preload: "/app/preload.cjs",
      partition: "pstdio-workbench",
    });
    expect(options.webPreferences.partition).not.toStartWith("persist:");
  });

  test("allows only exact runtime navigation and validated HTTPS external links", () => {
    const policy = {
      lifecycleUrl: "pstdio://lifecycle/index.html",
      runtimeOrigin: "http://127.0.0.1:43127",
    };

    expect(decideNavigation("http://127.0.0.1:43127/projects/one", policy)).toBe("allow");
    expect(decideNavigation("http://localhost:43127/projects/one", policy)).toBe("deny");
    expect(decideNavigation("pstdio://lifecycle/index.html#recovery", policy)).toBe("allow");
    expect(decideNavigation("https://prompt.studio/docs", policy)).toBe("external");
    expect(decideNavigation("http://prompt.studio/docs", policy)).toBe("deny");
    expect(isAllowedExternalUrl("https://user:pass@prompt.studio/docs")).toBe(false);
  });

  test("defines a restrictive CSP", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });
});
