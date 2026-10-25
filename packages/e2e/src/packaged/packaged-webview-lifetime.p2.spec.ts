import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";

test("built settings frames own independent captures through replacement and disposal", async ({ page }) => {
  const root = mkdtempSync(join(tmpdir(), "webview-lifetime-"));
  try {
    const fixture = join(import.meta.dirname, "../../../pstdio-workbench/src/react/settings");
    // Ignore the package's development aliases so this consumes built exports.
    const tsconfig = join(root, "tsconfig.json");
    writeFileSync(tsconfig, JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    const build = spawnSync(
      "bun",
      [
        "build",
        join(fixture, "settings-lifetime.fixture.tsx"),
        join(fixture, "settings-lifetime-guest.fixture.ts"),
        "--target=browser",
        "--tsconfig-override",
        tsconfig,
        `--outdir=${root}`,
      ],
      { encoding: "utf8" },
    );
    expect(build.status, build.stderr).toBe(0);
    const runtime = readFileSync(
      join(import.meta.dirname, "../../../pstdio-extensions/src/bridge/webview-runtime/runtime.bundle.js"),
      "utf8",
    );
    await page.route("http://lifetime-fixture.test/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = { "access-control-allow-origin": "*" };
      if (path === "/runtime")
        return route.fulfill({ contentType: "text/html", headers, body: renderInlineExtensionRuntimeHtml(runtime) });
      if (path === "/guest.js" || path === "/host.js")
        return route.fulfill({
          contentType: "text/javascript",
          headers,
          body: readFileSync(
            join(root, path === "/guest.js" ? "settings-lifetime-guest.fixture.js" : "settings-lifetime.fixture.js"),
          ),
        });
      return route.fulfill({
        contentType: "text/html",
        body: '<div id="app"></div><output id="ownership"></output><button id="close">Close host</button><button id="emit">Emit sample</button><script type="module" src="/host.js"></script>',
      });
    });
    await page.goto("http://lifetime-fixture.test/");
    const first = page.frameLocator('iframe[title="First"]');
    const second = page.frameLocator('iframe[title="Second"]');
    await expect(first.locator("output")).toHaveText("Received 0");
    await expect(second.locator("output")).toHaveText("Received 0");
    const ownership = async () => JSON.parse((await page.locator("#ownership").textContent())!);
    await expect.poll(ownership).toEqual({ retained: 2, released: 0, subscriptions: 2 });
    // Escape overlay modality for host-side diagnostic controls without invoking
    // any guest cleanup. Events must still reach both separate frame transports.
    await page.locator("#emit").dispatchEvent("click");
    await expect(first.locator("output")).toHaveText("Received 1");
    await expect(second.locator("output")).toHaveText("Received 1");
    await page.locator('iframe[title="First"]').evaluate((frame) => {
      const parent = frame.parentElement!;
      frame.remove();
      parent.append(frame);
    });
    await expect.poll(ownership).toEqual({ retained: 3, released: 1, subscriptions: 2 });
    await expect(first.locator("output")).toHaveText("Received 0");
    await page.locator("#emit").dispatchEvent("click");
    await expect(first.locator("output")).toHaveText("Received 1");
    await expect(second.locator("output")).toHaveText("Received 2");
    await page.getByRole("button", { name: "Remove First", exact: true }).click();
    await expect(page.locator('iframe[title="First"]')).toHaveCount(0);
    await expect.poll(ownership).toEqual({ retained: 3, released: 2, subscriptions: 1 });
    await page.locator("#emit").dispatchEvent("click");
    await expect(second.locator("output")).toHaveText("Received 3");
    await page.locator("#close").dispatchEvent("click");
    await expect.poll(ownership).toEqual({ retained: 3, released: 3, subscriptions: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
