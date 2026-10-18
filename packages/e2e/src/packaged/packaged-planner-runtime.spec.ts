// Planner serves populated projects and recovers webviews in a running packaged host.
import type { ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary, runPackagedAsync } from "./packaged-helpers";
import {
  ACTIVE_CONFLICTS,
  ARCHIVED_CONFLICTS,
  type Execute,
  plannerCommands,
  plannerSource,
  seedTrackProject,
} from "./packaged-planner-runtime-fixture";
import {
  type RuntimeDescriptor,
  runtimeAuthorization,
  signInBrowser,
  startPackagedServe,
  stopProcess,
} from "./packaged-serve-helpers";

test.afterEach(stopPendingTestProcesses);
test.afterAll(stopPendingTestProcesses);

const REQUIRE_WEBVIEW_BROWSERS = process.env.E2E_REQUIRE_WEBVIEW_BROWSERS === "1";
const browserTest = existsSync(chromium.executablePath()) || REQUIRE_WEBVIEW_BROWSERS ? test : test.skip;

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

type Host = { baseUrl: string; descriptor: RuntimeDescriptor; home: string };

const createProject = async (host: Host, name: string) => {
  const folder = join(host.home, name);
  mkdirSync(folder);
  const response = await fetch(`${host.baseUrl}/v1/projects`, {
    body: JSON.stringify(folderProjectInput({ name }, folder)),
    headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
    method: "POST",
  });
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  const execute = plannerCommands({
    baseUrl: host.baseUrl,
    headers: runtimeAuthorization(host.descriptor),
    projectId: id,
  });
  return { execute, folder, id };
};

const installPlanner = (host: Host, cwd: string) =>
  runPackagedAsync(["extensions", "add", plannerSource, "--name", "pstdio-planner"], cwd, {
    HOME: host.home,
    PSTDIO_HOME: host.home,
  });

const plannerInstance = async (host: Host, projectId: string) => {
  const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/extensions`, {
    headers: runtimeAuthorization(host.descriptor),
  });
  const { extensions } = (await response.json()) as { extensions: { id: string; installName: string }[] };
  return extensions.find((instance) => instance.installName === "pstdio-planner");
};

// Installing from one project enables Planner there. Other projects receive a disabled instance
// once the host notices the new user extension, and enable it themselves.
const enablePlanner = async (host: Host, projectId: string) => {
  await expect.poll(() => plannerInstance(host, projectId)).toBeTruthy();
  const instance = (await plannerInstance(host, projectId))!;
  const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/extensions/${instance.id}`, {
    body: JSON.stringify({ enabled: true }),
    headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
    method: "PATCH",
  });
  expect(response.status).toBe(200);
};

const reloadPlanner = async (host: Host, projectId: string) => {
  const planner = (await plannerInstance(host, projectId))!;
  const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/extensions/${planner.id}/reload`, {
    headers: runtimeAuthorization(host.descriptor),
    method: "POST",
  });
  expect(response.status).toBe(200);
  return response.json();
};

const plannerWebview = async (host: Host, projectId: string, localId: string) => {
  const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/extensions/ui`, {
    headers: runtimeAuthorization(host.descriptor),
  });
  const metadata = (await response.json()) as WorkbenchExtensionMetadata;
  const view = metadata.views.find(
    (entry) => entry.extensionId === "pstdio.pstdio-planner" && entry.localId === localId,
  );
  return view?.body.kind === "webview" ? view.body.webview : undefined;
};

// Reads the module URL the metadata names for a view, as the browser does.
const moduleStatus = async (host: Host, projectId: string, localId: string) => {
  const webview = await plannerWebview(host, projectId, localId);
  if (!webview?.moduleUrl) return { status: 0, body: "missing module URL" };
  const response = await fetch(`${host.baseUrl}${webview.moduleUrl}`);
  return { status: response.status, body: response.ok ? "" : await response.text() };
};

const openTimeline = async (page: Page, host: Host, projectId: string) => {
  await page.goto(`${host.baseUrl}/projects/${projectId}/extensions/pstdio.pstdio-planner/ticket-timeline`);
  return page.locator('[data-workbench-region="main"]').frameLocator("iframe");
};

const timelineCache = (host: Host) => {
  const root = join(host.home, "cache", "extension-webviews");
  const [installedId] = readdirSync(root);
  return join(root, installedId!, "pstdio.pstdio-planner.view.timeline", "dist");
};

type TicketRow = { title: string; attributes: Record<string, unknown> };

// Ticket rows carry every active and archived ticket with the stored option ids of each property.
const ticketRows = async (execute: Execute) => (await execute<{ rows: TicketRow[] }>("query-tickets")).rows;

const expectConflictsPreserved = async (execute: Execute, trackId: string, trackOptions: string[]) => {
  const conflicts = (await ticketRows(execute)).filter((row) =>
    trackOptions.every((id) => (row.attributes[trackId] as string[]).includes(id)),
  );
  // Active tickets plus the stored draft.
  expect(conflicts.filter((row) => row.attributes.archived === "active")).toHaveLength(ACTIVE_CONFLICTS + 1);
  expect(conflicts.filter((row) => row.attributes.archived === "archived")).toHaveLength(ARCHIVED_CONFLICTS);
};

browserTest("serves populated Planner projects and recovers cached webviews", async () => {
  const startedAt = Date.now();
  const phase = (name: string) => logTestPhase(`Planner browser ${name} (${Date.now() - startedAt}ms)`);
  phase("runtime start");
  const home = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-packaged-planner-runtime-")));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const started = await startPackagedServe(home, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
    child = started.child;
    const host = { baseUrl: started.baseUrl, descriptor: started.descriptor, home };
    phase("runtime ready");
    const conflicting = await createProject(host, "conflicting-track");
    const valid = await createProject(host, "valid-track");

    phase("install start");
    await installPlanner(host, conflicting.folder);
    await enablePlanner(host, valid.id);
    phase("install complete; seed start");
    const [conflictData] = await Promise.all([
      seedTrackProject(conflicting.execute, "multi_select"),
      seedTrackProject(valid.execute, "single_select"),
    ]);
    phase("seed complete");
    expect(await moduleStatus(host, valid.id, "ticket-tags-settings")).toEqual({ status: 200, body: "" });

    // A valid Track cannot hide a missing module behind a schema error.
    expect(await moduleStatus(host, valid.id, "timeline")).toEqual({ status: 200, body: "" });
    browser = await chromium.launch(PROVISIONED_CHROMIUM);
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    let timeline = await openTimeline(page, host, valid.id);
    await expect(timeline.getByText("Product", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(timeline.getByText("Seeded ticket 0", { exact: true })).toBeVisible();

    const focusedView = await valid.execute<{ id: string }>("timeline.views.create", {
      value: {
        title: "Timeline focus",
        filter: {
          conjunction: "and",
          rules: [{ attributeId: "title", condition: "contains", value: "Seeded ticket 0" }],
        },
      },
    });
    const selectionSaved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/preferences/timelineViewState") &&
        response.request().method() === "PUT" &&
        Boolean(response.request().postData()?.includes(focusedView.id)) &&
        response.ok(),
    );
    const focusedTab = timeline.getByRole("tab", { name: "Timeline focus", exact: true });
    await focusedTab.click();
    await expect(focusedTab).toHaveAttribute("aria-selected", "true");
    await selectionSaved;
    await page.goto(`${host.baseUrl}/projects/${valid.id}/extensions/pstdio.pstdio-planner/tickets`);
    await expect(page.getByRole("tab", { name: "Timeline focus", exact: true })).toHaveCount(0);
    timeline = await openTimeline(page, host, valid.id);
    await page.reload();
    await expect(timeline.getByRole("tab", { name: "Timeline focus", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(timeline.getByRole("button", { name: /Seeded ticket 0$/ })).toBeVisible();
    await expect(timeline.getByRole("button", { name: /Seeded ticket 1$/ })).toHaveCount(0);
    await timeline.getByRole("tab", { name: "All", exact: true }).click();
    await valid.execute("timeline.views.delete", { id: focusedView.id });

    // Exercise the shared control against Planner's installed runtime dependencies.
    await timeline.getByRole("button", { name: "Auto Build", exact: true }).click();
    const autoBuild = timeline.getByRole("dialog", { name: "Auto Build", exact: true });
    await autoBuild.getByRole("button", { name: "Filter", exact: true }).click();
    const filterMenu = timeline.getByTestId("filter-menu");
    await filterMenu.getByRole("button", { name: "Title", exact: true }).click();
    await filterMenu.getByRole("textbox", { name: "Value", exact: true }).fill("Seeded");
    await filterMenu.getByRole("button", { name: "Apply filter", exact: true }).click();
    await expect(autoBuild.getByRole("group", { name: "Title filter", exact: true })).toBeVisible();
    await autoBuild.getByRole("textbox", { name: "Value", exact: true }).press("Enter");
    await autoBuild.getByRole("button", { name: "Remove Title filter", exact: true }).click();
    await expect(autoBuild.getByRole("group", { name: "Title filter", exact: true })).toHaveCount(0);
    await autoBuild.getByRole("button", { name: "Cancel", exact: true }).click();

    phase("views checked; conflict start");
    // Ordinary ticket work stays available while host chrome reports the Track problem.
    expect(await ticketRows(conflicting.execute)).toHaveLength(ACTIVE_CONFLICTS + ARCHIVED_CONFLICTS + 3);
    timeline = await openTimeline(page, host, conflicting.id);
    await expect(page.getByText(/Track must be a single-select property/)).toBeVisible({ timeout: 30_000 });

    const trackOptions = [conflictData.product.id, conflictData.platform.id];
    await expect(
      conflicting.execute("ticket-tag.update", { tagId: conflictData.track.id, type: "single_select" }),
    ).rejects.toThrow(new RegExp(`Track has more than one value on .*${conflictData.draft.shorthand}`));
    await expectConflictsPreserved(conflicting.execute, conflictData.track.id, trackOptions);

    phase("repair start");
    await Promise.all(
      [...conflictData.active, ...conflictData.archived].map((ticket) =>
        conflicting.execute("set-ticket-attribute", {
          rowId: ticket.id,
          attributeId: conflictData.track.id,
          value: conflictData.product.id,
        }),
      ),
    );
    await conflicting.execute("update-ticket", {
      id: conflictData.draft.shorthand,
      tagIds: [conflictData.platform.id],
    });
    await conflicting.execute("ticket-tag.update", { tagId: conflictData.track.id, type: "single_select" });
    const resolved = await ticketRows(conflicting.execute);
    expect(resolved).toHaveLength(ACTIVE_CONFLICTS + ARCHIVED_CONFLICTS + 3);
    expect(resolved.filter((row) => row.attributes.archived === "archived")).toHaveLength(ARCHIVED_CONFLICTS);
    expect(
      resolved.filter((row) => (row.attributes[conflictData.area.id] as string[]).includes(conflictData.ui.id)),
    ).toHaveLength(ACTIVE_CONFLICTS);
    expect(resolved.filter((row) => row.attributes[conflictData.track.id] === conflictData.product.id)).toHaveLength(
      ACTIVE_CONFLICTS + ARCHIVED_CONFLICTS,
    );
    expect(resolved.every((row) => row.title.startsWith("Seeded"))).toBe(true);
    phase("repair complete; reload");
    await page.reload();
    await expect(timeline.getByText("Platform", { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    phase("reload complete; asset recovery start");
    // An asset request republishes a module that disappeared while its signature remained.
    rmSync(join(timelineCache(host), "module.js"));
    expect(await moduleStatus(host, valid.id, "timeline")).toEqual({ status: 200, body: "" });
    expect(await moduleStatus(host, valid.id, "ticket-tags-settings")).toEqual({ status: 200, body: "" });
    rmSync(join(timelineCache(host), ".."), { recursive: true });
    expect(await moduleStatus(host, valid.id, "timeline")).toEqual({ status: 200, body: "" });

    // Reload repairs a view whose import failed in the open browser session. Reload, not the file
    // watcher, decides when each version builds.
    const entry = join(home, "extensions", "pstdio-planner", "src", "timeline", "view", "entry.tsx");
    const original = readFileSync(entry, "utf8");
    writeFileSync(entry, `${original}\nexport const broken = ;\n`);
    expect(await reloadPlanner(host, valid.id)).toMatchObject({
      status: "error",
      lastError: { code: "extension_webview_build_failed" },
    });
    const webview = await plannerWebview(host, valid.id, "timeline");
    expect(await (await fetch(`${host.baseUrl}${webview!.moduleUrl}`)).text()).toContain(
      "Extension webview build failed",
    );
    timeline = await openTimeline(page, host, valid.id);
    await expect(page.getByText(/Extension view failed to load/)).toBeVisible({ timeout: 30_000 });
    writeFileSync(entry, original);
    expect(await reloadPlanner(host, valid.id)).toMatchObject({ status: "loaded", lastError: null });
    await expect(timeline.getByText("Seeded ticket 0", { exact: true })).toBeVisible({ timeout: 30_000 });
    phase("checks complete");
  } finally {
    phase("cleanup start");
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(home, { recursive: true, force: true });
  }
});
