import type { ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { installBuiltSdk } from "../helpers/installed-sdk";
import { writePublicTextExtensions } from "../helpers/public-text-extension";
import { verifyNativePublicTextEditor, verifyPublicTextEditor } from "../helpers/verify-public-text-editor";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, test as base, chromium, expect } from "../scripts/playwright-test";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

interface Resources {
  root: string;
  host?: ChildProcess;
  browser?: Browser;
}
const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use) => {
    const resources: Resources = { root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-legacy-text-"))) };
    const errors: unknown[] = [];
    try {
      await use(resources);
    } catch (error) {
      errors.push(error);
    }
    const results = await Promise.allSettled([
      stopPendingTestProcesses(),
      resources.browser?.close(),
      resources.host ? stopProcess(resources.host) : undefined,
    ]);
    rmSync(resources.root, { recursive: true, force: true });
    for (const result of results) if (result.status === "rejected") errors.push(result.reason);
    if (errors.length) throw new AggregateError(errors, "Legacy text fixture cleanup failed");
  },
});

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("legacy Markdown uses public text admission and shares edits and chrome presence with an installed editor", async ({
  resources,
}, testInfo) => {
  // A private-only renderer leaves published legacy file views outside the supported editor lifecycle.
  const { root } = resources;
  const editor = writePublicTextExtensions(root).editor;
  const source = join(root, "legacy-native-text-source");
  mkdirSync(source);
  cpSync(join(import.meta.dirname, "../fixtures/legacy-native-text-source"), source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "legacy-native-text-source",
      publisher: "paper",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  installBuiltSdk(source);
  const started = await startPackagedServe(root, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [
        { source: editor, installName: "public-text-editor" },
        { source, installName: "legacy-native-text-source" },
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
    body: JSON.stringify(folderProjectInput({ name: "Legacy public text" }, folder)),
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as { id: string };
  const seeded = await fetch(
    `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/paper.legacy-native-text-source.command.seed/execute`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    },
  );
  expect(seeded.ok).toBe(true);
  resources.browser = await chromium.launch({ headless: true, ...PACKAGED_DASHBOARD_BROWSER });
  const context = await resources.browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (window.top === window) localStorage.setItem("onboarding-complete", "true");
  });
  const nativePage = await context.newPage();
  const operations: string[] = [];
  nativePage.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/text-editing/request"))
      operations.push(request.postDataJSON()?.request?.operation);
  });
  await signInBrowser(nativePage, started.descriptor);
  const route = `${started.baseUrl}/projects/${project.id}/extensions/paper.legacy-native-text-source`;
  await nativePage.goto(`${route}/native`);
  const native = await verifyNativePublicTextEditor(nativePage, "Shared legacy text");
  expect(operations).toContain("open");
  const peerPage = await context.newPage();
  await peerPage.goto(`${route}/custom`);
  const peer = await verifyPublicTextEditor(peerPage, true, "Shared legacy text");
  const physical = () =>
    readFileSync(join(folder, ".pstdio/extension-storage/paper.legacy-native-text-source/documents/shared.md"), "utf8");
  const converges = async (text: string) => {
    await expect(native).toHaveText(text);
    await expect(peer).toHaveValue(text);
    await expect.poll(physical).toBe(text);
  };
  await native.fill("Native Shared legacy text");
  await converges("Native Shared legacy text");
  expect(operations).toContain("submit");
  await peer.fill("Native Shared legacy text Installed");
  await converges("Native Shared legacy text Installed");
  for (const page of [nativePage, peerPage]) {
    const people = page.getByRole("list", { name: "Other editors", exact: true }).getByRole("listitem");
    await expect(people).toHaveCount(1);
    await expect(people.first()).toHaveAttribute("aria-label", /\S+/);
  }
  await nativePage.goto(`${started.baseUrl}/projects/${project.id}`);
  await expect(peerPage.getByRole("list", { name: "Other editors", exact: true })).toHaveCount(0);
  expect(physical()).toBe("Native Shared legacy text Installed");
  await testInfo.attach("native-public-operations", {
    body: JSON.stringify(operations),
    contentType: "application/json",
  });
});
