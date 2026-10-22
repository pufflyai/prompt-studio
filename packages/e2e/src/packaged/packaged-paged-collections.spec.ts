import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writePagedCollectionFixtures } from "./paged-collection-fixtures";
import { exercisePagedCollections } from "./paged-collections-browser";

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});
test("public paged views render bounded rows and preserve page navigation", async (_fixtures, testInfo) => {
  const root = mkdtempSync(join(tmpdir(), "paged-collections-browser-"));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const extensions = await writePagedCollectionFixtures(root);
    const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(extensions) });
    child = runtime.child;
    const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Paged views" }, root)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    for (let owner = 0; owner < 10; owner++) {
      const response = await fetch(
        `${runtime.baseUrl}/v1/projects/${project.id}/extensions/commands/example.paged-owner-${owner}.command.seed/execute`,
        { method: "POST", headers, body: JSON.stringify({ params: {} }) },
      );
      expect((await response.json()).outcome.ok).toBe(true);
    }
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await signInBrowser(page, runtime.descriptor);
    await exercisePagedCollections(
      page,
      runtime.baseUrl,
      project.id,
      async (evidence) => {
        await testInfo.attach("paged-responses-and-readiness", {
          body: JSON.stringify(evidence, null, 2),
          contentType: "application/json",
        });
        await testInfo.attach("paged-board", { body: await page.screenshot(), contentType: "image/png" });
      },
      async (rank) => {
        const response = await fetch(
          `${runtime.baseUrl}/v1/projects/${project.id}/extensions/commands/example.paged-owner-0.command.move/execute`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ params: { id: "row-0000", rank } }),
          },
        );
        expect((await response.json()).outcome.ok).toBe(true);
      },
    );
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
