import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { writePublicTextExtensions } from "../helpers/public-text-extension";
import { observePublicTextInput } from "../helpers/public-text-input-observer";
import { verifyNativePublicTextEditor, verifyPublicTextEditor } from "../helpers/verify-public-text-editor";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, test as base, chromium, expect, type Route } from "../scripts/playwright-test";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

interface Resources {
  root: string;
  host?: ChildProcess;
  browser?: Browser;
  observation?: Awaited<ReturnType<typeof observePublicTextInput>>;
}
const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use, testInfo) => {
    const resources: Resources = { root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-public-tables-"))) };
    const failures: unknown[] = [];
    try {
      await use(resources);
    } catch (error) {
      failures.push(error);
    }
    await stopPendingTestProcesses().catch((error) => failures.push(error));
    const stopped = await Promise.allSettled([
      resources.browser?.close(),
      resources.host ? stopProcess(resources.host) : undefined,
    ]);
    for (const result of stopped) if (result.status === "rejected") failures.push(result.reason);
    if (resources.observation)
      await testInfo
        .attach("public-input", {
          body: JSON.stringify(resources.observation, null, 2),
          contentType: "application/json",
        })
        .catch((error) => failures.push(error));
    try {
      rmSync(resources.root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) throw new AggregateError(failures, "Public table fixture cleanup failed");
  },
});
test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("native public editors preserve selection and table drafts retain foreign edits through cancel save and undo", async ({
  resources,
}) => {
  // Concurrent native input, lost selection and publishing a tentative cell can destroy a person's ongoing work.
  const { root } = resources;
  const sources = writePublicTextExtensions(root);
  const started = await startPackagedServe(root, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [
        { source: sources.editor, installName: "public-text-editor" },
        { source: sources.source, installName: "public-text-source" },
      ],
    }),
  });
  resources.host = started.child;
  const folder = join(root, "project");
  mkdirSync(folder);
  const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
  const created = await fetch(`${started.baseUrl}/v1/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify(folderProjectInput({ name: "Public tables" }, folder)),
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as { id: string };
  for (const owner of ["paper.public-text-source", "ink.public-text-editor"]) {
    const response = await fetch(
      `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/${owner}.command.seed/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ input: {} }),
      },
    );
    expect(response.ok).toBe(true);
  }
  const browser = await chromium.launch({ headless: true, ...PACKAGED_DASHBOARD_BROWSER });
  resources.browser = browser;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (window.top === window) localStorage.setItem("onboarding-complete", "true");
  });
  const nativePage = await context.newPage();
  const observed = await observePublicTextInput(nativePage);
  resources.observation = observed;
  await signInBrowser(nativePage, started.descriptor);
  const route = `${started.baseUrl}/projects/${project.id}/extensions/paper.public-text-source`;
  await nativePage.goto(`${route}/native`);
  const left = await verifyNativePublicTextEditor(nativePage, "Shared source");
  const secondPage = await context.newPage();
  await secondPage.goto(`${route}/native`);
  const right = await verifyNativePublicTextEditor(secondPage, "Shared source");
  const physical = () =>
    readFileSync(join(folder, ".pstdio/extension-storage/paper.public-text-source/documents/selected.md"), "utf8");
  const gate = Promise.withResolvers<void>();
  const held = new Set<string>();
  const admit = (name: string) => async (route: Route) => {
    if (route.request().postDataJSON()?.request?.operation === "submit" && !held.has(name)) {
      held.add(name);
      await gate.promise;
    }
    await route.continue();
  };
  const leftAdmission = admit("first native");
  const rightAdmission = admit("second native");
  await nativePage.route("**/text-editing/request", leftAdmission);
  await secondPage.route("**/text-editing/request", rightAdmission);
  try {
    await Promise.all([left.fill("Left: Shared source"), right.fill("Shared source: Right")]);
    await expect.poll(() => held.size).toBe(2);
    await expect(left).toHaveText("Left: Shared source");
    await expect(right).toHaveText("Shared source: Right");
  } finally {
    gate.resolve();
  }
  const concurrent = "Left: Shared source: Right";
  await expect(left).toHaveText(concurrent);
  await expect(right).toHaveText(concurrent);
  await expect.poll(physical).toBe(concurrent);
  await nativePage.unroute("**/text-editing/request", leftAdmission);
  await secondPage.unroute("**/text-editing/request", rightAdmission);

  await left.press("ControlOrMeta+a");
  await left.press("ArrowLeft");
  for (let index = 0; index < 6; index++) await left.press("ArrowRight");
  for (let index = 0; index < 13; index++) await left.press("Shift+ArrowRight");
  const selection = () => nativePage.evaluate(() => window.getSelection()?.toString());
  await expect.poll(selection).toBe("Shared source");
  await right.fill(`PREFIX ${concurrent}`);
  await expect(left).toHaveText(`PREFIX ${concurrent}`);
  await expect.poll(physical).toBe(`PREFIX ${concurrent}`);
  await expect.poll(selection).toBe("Shared source");
  await secondPage.close();

  const peerPage = await context.newPage();
  await peerPage.goto(`${route}/shared`);
  const peer = await verifyPublicTextEditor(peerPage, true, `PREFIX ${concurrent}`);
  const initial = "| A | B |\n| --- | --- |\n| left | right |\n\nOutside marker\n";
  await peer.fill(initial);
  await expect.poll(physical).toBe(initial);
  const table = nativePage.getByTestId("markdown-table-node");
  await expect(table.getByRole("cell", { name: "left", exact: true })).toBeVisible();
  await expect.poll(() => observed.submissions().length).toBeGreaterThan(0);
  const received = async (value: string) => {
    await expect
      .poll(() => observed.snapshots.filter((snapshot) => snapshot.via === "stream").at(-1)?.text)
      .toBe(value);
    await expect.poll(physical).toBe(value);
    await expect(peer).toHaveValue(value);
    await expect(table.getByRole("cell", { name: "PEER right", exact: true })).toBeVisible();
    if (value.includes("Outside REMOTE marker")) await expect(left).toContainText("Outside REMOTE marker");
  };
  const draftEditor = nativePage.locator("[data-table-cell-editor-body]").getByTestId("content-editable");
  await table.getByRole("cell", { name: "left", exact: true }).click();
  await expect(draftEditor).toHaveText("left");
  const beforeCancel = observed.submissions().length;
  await draftEditor.fill("cancel this draft");
  await expect(draftEditor).toHaveText("cancel this draft");
  const remote = initial.replace("| left | right |", "| left | PEER right |");
  await peer.fill(remote);
  await received(remote);
  await expect(draftEditor).toHaveText("cancel this draft");
  expect(observed.submissions()).toHaveLength(beforeCancel);
  await nativePage.getByRole("button", { name: "Cancel cell edit", exact: true }).click();
  await expect(draftEditor).toHaveCount(0);
  await received(remote);
  await expect(table.getByRole("cell", { name: "left", exact: true })).toBeVisible();
  expect(observed.submissions()).toHaveLength(beforeCancel);

  await table.getByRole("cell", { name: "left", exact: true }).click();
  await expect(draftEditor).toHaveText("left");
  await draftEditor.fill("local left");
  const foreign = remote.replace("Outside marker", "Outside REMOTE marker");
  await peer.fill(foreign);
  await received(foreign);
  await expect(draftEditor).toHaveText("local left");
  expect(observed.submissions()).toHaveLength(beforeCancel);
  await nativePage.getByRole("button", { name: "Save cell", exact: true }).click();
  const committed = foreign.replace("| left | PEER right |", "| local left | PEER right |");
  await received(committed);
  await expect(draftEditor).toHaveCount(0);
  await expect(table.getByRole("cell", { name: "local left", exact: true })).toBeVisible();
  await expect.poll(() => observed.submissions().length).toBeGreaterThan(beforeCancel);
  await table.press("ControlOrMeta+z");
  await received(foreign);
  await expect(table.getByRole("cell", { name: "left", exact: true })).toBeVisible();
  await table.press("ControlOrMeta+Shift+z");
  await received(committed);
  await expect(table.getByRole("cell", { name: "local left", exact: true })).toBeVisible();
});
