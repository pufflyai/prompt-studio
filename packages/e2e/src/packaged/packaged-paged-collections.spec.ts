import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeDiscoveredColumnsFixture, writePagedCollectionFixtures } from "./paged-collection-fixtures";
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

test("collapsed paged groups retain their expand controls", async () => {
  const root = mkdtempSync(join(tmpdir(), "paged-groups-browser-"));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  const responses: unknown[] = [];
  const phase = (name: string) => console.log(`Paged groups: ${name}`);
  try {
    const extensions = await writePagedCollectionFixtures(root);
    const runtime = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(extensions.slice(0, 1)),
    });
    child = runtime.child;
    phase("runtime ready");
    const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Paged groups" }, root)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    const seeded = await fetch(
      `${runtime.baseUrl}/v1/projects/${project.id}/extensions/commands/example.paged-owner-0.command.seed/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ params: {} }),
      },
    );
    expect((await seeded.json()).outcome.ok).toBe(true);
    phase("seeded");
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("response", async (response) => {
      if (response.url().endsWith(".query/execute")) {
        const output = await response.json().catch(() => null);
        responses.push({ input: response.request().postDataJSON(), output });
        console.log(
          "Paged query",
          JSON.stringify({
            input: response.request().postDataJSON(),
            ok: output?.outcome?.ok,
            rows: output?.outcome?.value?.rows?.length,
            page: output?.outcome?.value?.page,
          }),
        );
      }
    });
    await signInBrowser(page, runtime.descriptor);
    phase("signed in");
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`${runtime.baseUrl}/projects/${project.id}`);
    phase("project open");
    await page.getByRole("option", { name: "paged-owner-0 table", exact: true }).click();
    await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Display settings", exact: true }).click();
    await page.getByRole("button", { name: "Grouping None", exact: true }).click();
    await page.getByRole("menuitem", { name: "Status", exact: true }).click();
    await page.keyboard.press("Escape");
    const done = page.getByTestId("data-table-group-row").getByRole("button", { name: "done 125", exact: true });
    const todo = page.getByTestId("data-table-group-row").getByRole("button", { name: "todo 125", exact: true });
    phase("click done");
    await done.click();
    await expect(done).toHaveAttribute("aria-expanded", "false");
    phase("click todo");
    const collapsed = page.waitForResponse(
      (response) =>
        response.url().endsWith(".query/execute") &&
        response.request().postDataJSON()?.params?.page?.collapsedGroups?.length === 2,
    );
    await todo.click();
    expect((await (await collapsed).json()).outcome.value.rows).toEqual([]);
    await expect(todo).toHaveAttribute("aria-expanded", "false");
    await expect(done).toBeVisible();
    phase("click done");
    await done.click();
    await expect(done).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("cell", { name: "paged-owner-0 row 0001", exact: true })).toBeVisible();
  } finally {
    phase("cleanup");
    await test
      .info()
      .attach("group-query-responses", { body: JSON.stringify(responses, null, 2), contentType: "application/json" });
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});

test("paged tables request discovered and changed columns", async () => {
  const root = mkdtempSync(join(tmpdir(), "paged-columns-browser-"));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const extensions = writeDiscoveredColumnsFixture(root);
    const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(extensions) });
    child = runtime.child;
    const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Paged columns" }, root)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await signInBrowser(page, runtime.descriptor);
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`${runtime.baseUrl}/projects/${project.id}`);
    let failReload = true;
    await page.route("**/commands/*/execute", async (route) => {
      if (
        failReload &&
        route.request().url().includes(".view.changed.") &&
        route.request().postDataJSON()?.params?.page?.fields.includes("value")
      ) {
        failReload = false;
        await route.fulfill({
          json: { outcome: { ok: false, status: "error", error: { message: "Column reload failed" } } },
        });
      } else await route.continue();
    });
    for (const name of ["Discovered columns", "Changed columns"]) {
      await page.getByRole("option", { name, exact: true }).click();
      if (name === "Changed columns") {
        await expect(page.getByText("Column reload failed", { exact: false })).toBeVisible();
        await page.getByRole("button", { name: "Retry", exact: true }).click();
      }
      await expect(
        page.getByRole("columnheader", { name: "Current column Column options", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("cell", { name: `${project.id} discovered field value`, exact: true })).toBeVisible();
    }

    const otherFolder = join(root, "other-project");
    mkdirSync(otherFolder);
    const otherCreated = await fetch(`${runtime.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Other column scope" }, otherFolder)),
    });
    expect(otherCreated.status).toBe(201);
    const other = (await otherCreated.json()) as { id: string };
    const held = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const delivered = Promise.withResolvers<void>();
    await page.route("**/commands/*/execute", async (route) => {
      if (
        route.request().url().includes(`/projects/${project.id}/`) &&
        route.request().postDataJSON()?.params?.page?.search === "pending"
      ) {
        const response = await route.fetch();
        held.resolve();
        await release.promise;
        await route.fulfill({ response }).catch(() => {});
        delivered.resolve();
      } else await route.fallback();
    });
    try {
      await page.getByRole("option", { name: "Discovered columns", exact: true }).click();
      await page.getByRole("button", { name: "Search this view", exact: true }).click();
      await page.getByRole("textbox", { name: "Search this view", exact: true }).fill("pending");
      await held.promise;
      await page.getByRole("button", { name: "Switch project", exact: true }).click();
      await page.getByRole("option", { name: "Other column scope", exact: true }).click();
      await page.getByRole("option", { name: "Discovered columns", exact: true }).click();
      await expect(page.getByRole("cell", { name: `${other.id} discovered field value`, exact: true })).toBeVisible();
      release.resolve();
      await delivered.promise;
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      await expect(page.getByRole("cell", { name: `${project.id} discovered field value`, exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByRole("cell", { name: `${other.id} discovered field value`, exact: true })).toBeVisible();
    } finally {
      release.resolve();
    }
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
