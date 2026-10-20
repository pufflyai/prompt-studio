import { expect, test } from "bun:test";
import { selectBrowserChecks } from "./browser-checks";

test("session changes select navigation and retained session state", () => {
  const checks = selectBrowserChecks(["packages/pstdio-api/src/features/sessions/session-service.ts"]);
  expect(checks).toContain("session-menu-parity.spec.ts");
  expect(checks).toContain("session-chat-state.spec.ts");
  expect(checks).not.toContain("marketplace-extension-lifecycle.spec.ts");
});

test("extension changes select lifecycle and opaque webview interactions", () => {
  const checks = selectBrowserChecks(["packages/pstdio-extensions/src/bridge/host.ts"]);
  expect(checks).toContain("marketplace-extension-lifecycle.spec.ts");
  expect(checks).toContain("webview-resource-rebinding.spec.ts");
});

test("shared contracts and shell changes cover every browser regression family", () => {
  for (const file of ["packages/sdk/src/index.ts", "packages/pstdio-workbench/src/core/panels.ts", "bun.lock"]) {
    const checks = selectBrowserChecks([file]);
    expect(checks, file).toContain("session-menu-parity.spec.ts");
    expect(checks, file).toContain("ticket-scroll-reset.spec.ts");
    expect(checks, file).toContain("marketplace-extension-lifecycle.spec.ts");
    expect(checks, file).toContain("webview-resource-rebinding.spec.ts");
  }
});

test("unrelated packages and prose do not select browser regressions", () => {
  expect(selectBrowserChecks(["clients/landing-page/src/index.astro", "packages/sdk/README.md"])).toEqual([]);
});

test("changed browser specs and helpers select their maintained regression family", () => {
  expect(selectBrowserChecks(["packages/e2e/src/ui/ticket-scroll-reset.spec.ts"])).toContain(
    "ticket-scroll-reset.spec.ts",
  );
  expect(selectBrowserChecks(["packages/e2e/src/ui/helpers/resource-actions.ts"])).toContain(
    "session-menu-parity.spec.ts",
  );
});
