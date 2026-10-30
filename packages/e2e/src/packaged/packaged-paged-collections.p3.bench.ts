import type { ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectionBudget } from "pstdio-benchmarks";
import { folderProjectInput } from "../helpers/folder-project";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { assertPagedCollectionBudget } from "./paged-collection-budget";
import { writePagedCollectionFixtures } from "./paged-collection-fixtures";
import { exercisePagedCollections } from "./paged-collections-browser";

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});
test("public paged views render bounded rows and preserve page navigation", async () => {
  const testInfo = test.info();
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
    const evidence = await exercisePagedCollections(
      page,
      runtime.baseUrl,
      project.id,
      async (evidence) => {
        await testInfo.attach("paged-responses-and-readiness", {
          body: JSON.stringify(
            {
              scenario: "Open and use a bounded collection page",
              workload: { owners: 10, rowsPerOwner: 250, pageSize: 100 },
              measuredProcess: "Chromium workbench renderer",
              start: "Navigation pointerdown",
              end: "Two animation frames after visible rows and usable controls",
              sourceRevision:
                process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
              binarySha256: createHash("sha256").update(readFileSync(PACKAGED_BINARY_PATH)).digest("hex"),
              runner: {
                os: process.platform,
                arch: process.arch,
                name: process.env.RUNNER_NAME,
                runId: process.env.GITHUB_RUN_ID,
              },
              metrics: evidence.map((sample) => ({ ...sample, unit: "ms", budget: collectionBudget.value })),
            },
            null,
            2,
          ),
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
    assertPagedCollectionBudget(evidence);
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
