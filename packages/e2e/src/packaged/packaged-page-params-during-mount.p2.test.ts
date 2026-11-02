import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect as expectBrowser } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { writePageParamsExtension } from "../helpers/page-params-extension";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("page params changed during async guest mount reach the initialized view", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-page-params-"));
  let child: ChildProcess | null = null;
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  try {
    const source = writePageParamsExtension(root);
    writeFileSync(
      join(source, "view.ts"),
      `export default { async mount(element, host, props) {
      element.innerHTML = '<p id="range"></p><p id="mounted"></p>';
      const draw = () => element.querySelector('#range').textContent = props.get().pageParams?.range ?? 'missing';
      draw();
      const dispose = props.subscribe(draw);
      await host.call('page.params.update', { params: { range: 'now-24h' } });
      // Keep init pending across the host's render/effect turn, without a time-based sleep.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      draw();
      element.querySelector('#mounted').textContent = 'done';
      return dispose;
    } };`,
    );
    const started = await startPackagedServe(root);
    child = started.child;
    const documentation = await fetch(`${started.baseUrl}/openapi.json`, {
      headers: runtimeAuthorization(started.descriptor),
    });
    expect(documentation.status).toBe(200);
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Page params" }, root)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    const page = await browser.newPage();
    await signInBrowser(page, started.descriptor);
    const path = `/projects/${project.id}/extensions/test.page-params/board?range=now-6h`;
    await page.goto(`${started.baseUrl}${path}`);
    const view = page.frameLocator('iframe[title="Page params"]');
    await view.locator("#mounted").getByText("done").waitFor();
    await expectBrowser(page).toHaveURL(/range=now-24h/);
    await expectBrowser(view.locator("#range")).toHaveText("now-24h");
  } finally {
    await browser.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
