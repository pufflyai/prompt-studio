import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { cpus, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import catalog from "../../../pstdio-api/files/extension-catalog.json" with { type: "json" };
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { homePage } from "../helpers/home-loading";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test("warm default tools stay interactive while offline edits are inspected", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-warm-defaults-"));
  const defaults = catalog.extensions.filter(
    (entry) => entry.default || ("alwaysEnabled" in entry && entry.alwaysEnabled),
  );
  const env = { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(...defaults.map((entry) => entry.installName)) };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = createServer(async (_request, response) => {
    entered.resolve();
    await release.promise;
    response.end("continue");
  });
  await new Promise<void>((resolve) => gate.listen(0, "127.0.0.1", resolve));
  const address = gate.address() as { port: number };
  const gateUrl = `http://127.0.0.1:${address.port}`;
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const first = await startPackagedServe(root, env);
    child = first.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const created = await fetch(`${first.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(first.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Warm default tools" }, folder)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, first.descriptor);
    await page.goto(`${first.baseUrl}/projects/${project.id}`);
    await expect(homePage(page)).toBeVisible();
    await expect(page.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
    await stopProcess(child);
    child = undefined;
    const entry = join(folder, ".pstdio", "extensions", "pstdio-home", "extension.ts");
    writeFileSync(entry, `await fetch(${JSON.stringify(gateUrl)});\n${readFileSync(entry, "utf8")}`);
    const started = performance.now();
    const warm = await startPackagedServe(root, env);
    child = warm.child;
    await signInBrowser(page, warm.descriptor);
    await page.goto(`${warm.baseUrl}/projects/${project.id}`);
    await expect(homePage(page)).toBeVisible();
    await page.getByRole("option", { name: "Sessions", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("New session");
    const usableMilliseconds = Math.round(performance.now() - started);
    await entered.promise;
    const evidence = {
      operation: "packaged_warm_default_tools",
      usableMilliseconds,
      cpu: cpus()[0]?.model,
      memoryBytes: totalmem(),
      defaults: defaults.map((entry) => entry.installName),
      background: "edited Home evaluation blocked",
      cache: "populated",
      extensionDownloads: "local sources only",
    };
    console.log(JSON.stringify(evidence));
    await test
      .info()
      .attach("warm-default-tools.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    if (cpus()[0]?.model.includes("Apple M5")) expect(usableMilliseconds).toBeLessThan(2000);
  } finally {
    release.resolve();
    await browser?.close();
    if (child) await stopProcess(child);
    gate.closeAllConnections();
    await new Promise<void>((resolve) => gate.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
