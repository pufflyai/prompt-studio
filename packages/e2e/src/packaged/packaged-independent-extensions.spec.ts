import type { ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary, runPackagedAsync } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeRegistryNotes } from "./registry-notes.fixture";
import { startRegistryService } from "./registry-service.fixture";
import { startRegistryWireFixture } from "./registry-wire.fixture";

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});
test("Upgrade installs an independently published Notes version while the packaged host stays unchanged", async () => {
  const testInfo = test.info();
  const root = await mkdtemp(join(tmpdir(), "packaged-registry-ui-"));
  const registry =
    process.env.PSTDIO_PSX_REAL_SERVICE === "1" ? await startRegistryService() : await startRegistryWireFixture();
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const source = join(root, "notes");
    const home = join(root, "host");
    const repo = join(root, "project");
    for (const dir of [home, repo]) await mkdir(dir);
    const publish = async (version: string) => {
      await writeRegistryNotes(source, version);
      const path = (
        await runPackagedAsync(["extensions", "pack", source, "--out-dir", root], root, { PSTDIO_HOME: home })
      ).trim();
      await registry.publish(path);
    };
    const hostVersion = await runPackagedAsync(["--version"], root, { PSTDIO_HOME: home });
    await publish("0.45.1");
    const host = await startPackagedServe(home, { PSTDIO_EXTENSION_RELEASE_REF: `psx:${registry.origin}` });
    child = host.child;
    const response = await fetch(`${host.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Independent updates" }, repo)),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    const env = { PSTDIO_HOME: home, PSTDIO_API_URL: host.baseUrl, PSTDIO_API_TOKEN: host.descriptor.token };
    await runPackagedAsync(["extensions", "add", "pstdio.pstdio-notes"], repo, env);
    await publish("0.45.2");
    browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, host.descriptor);
    await page.goto(`${host.baseUrl}/projects/${project.id}/sessions`);
    await page.getByText("Settings", { exact: true }).last().click();
    await page.getByText("Extensions", { exact: true }).last().click();
    await page.getByText("Notes", { exact: true }).last().click();
    await expect(page.getByTestId("extension-upgrade")).toBeVisible();
    await expect(page.getByText(/pstdio\.pstdio-notes.*v0\.45\.1/)).toBeVisible();
    await page.getByTestId("extension-upgrade").click();
    await expect(page.getByText(/pstdio\.pstdio-notes.*v0\.45\.2/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("independent-upgrade.png") });
    expect(await runPackagedAsync(["pstdio.pstdio-notes", "version", "--project-id", project.id], repo, env)).toContain(
      "0.45.2",
    );
    expect(await runPackagedAsync(["--version"], root, { PSTDIO_HOME: home })).toBe(hostVersion);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
