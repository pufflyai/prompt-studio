import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { writePublicTextExtensions } from "../helpers/public-text-extension";
import { observePublicTextInput } from "../helpers/public-text-input-observer";
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
  observation?: Awaited<ReturnType<typeof observePublicTextInput>>;
}

const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use, testInfo) => {
    const resources: Resources = { root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-public-ime-"))) };
    const failures: unknown[] = [];
    try {
      await use(resources);
    } catch (error) {
      failures.push(error);
    }
    await stopPendingTestProcesses().catch((error) => failures.push(error));
    const results = await Promise.allSettled([
      resources.browser?.close(),
      resources.host ? stopProcess(resources.host) : undefined,
    ]);
    for (const result of results) if (result.status === "rejected") failures.push(result.reason);
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
    if (failures.length) throw new AggregateError(failures, "Public composition fixture cleanup failed");
  },
});

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("native Markdown keeps IME candidates private and undo preserves changes from an installed public editor", async ({
  resources,
}) => {
  // Losing an in-progress composition or undoing another participant's text blocks normal editing.
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
    body: JSON.stringify(folderProjectInput({ name: "Public composition" }, folder)),
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as { id: string };
  for (const owner of ["paper.public-text-source", "ink.public-text-editor"]) {
    const response = await fetch(
      `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/${owner}.command.seed/execute`,
      { method: "POST", headers, body: JSON.stringify({ input: {} }) },
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
  const native = await verifyNativePublicTextEditor(nativePage, "Shared source");
  const peerPage = await context.newPage();
  await peerPage.goto(`${route}/shared`);
  const peer = await verifyPublicTextEditor(peerPage, true, "Shared source");
  const physical = () =>
    readFileSync(join(folder, ".pstdio/extension-storage/paper.public-text-source/documents/selected.md"), "utf8");
  const converges = async (value: string) => {
    await expect(native).toHaveText(value);
    await expect(peer).toHaveValue(value);
    await expect.poll(physical).toBe(value);
  };

  await native.fill("Shared source LOCAL");
  await converges("Shared source LOCAL");
  await peer.fill("REMOTE Shared source LOCAL");
  await converges("REMOTE Shared source LOCAL");
  await native.press("ControlOrMeta+z");
  await converges("REMOTE Shared source");
  await native.press("ControlOrMeta+Shift+z");
  await converges("REMOTE Shared source LOCAL");

  await expect.poll(() => observed.submissions().length).toBeGreaterThan(0);
  await expect
    .poll(() => observed.snapshots.some((snapshot) => snapshot.text === "REMOTE Shared source LOCAL"))
    .toBe(true);
  await native.press("ControlOrMeta+End");
  const cdp = await context.newCDPSession(nativePage);
  await cdp.send("Input.imeSetComposition", { text: "編", selectionStart: 1, selectionEnd: 1 });
  await expect(native).toHaveText("REMOTE Shared source LOCAL編");
  await cdp.send("Input.imeSetComposition", { text: "編集", selectionStart: 2, selectionEnd: 2 });
  await expect(native).toHaveText("REMOTE Shared source LOCAL編集");
  await expect.poll(() => observed.compositions().some((event) => event.type === "compositionupdate")).toBe(true);
  expect(observed.compositions().every((event) => event.trusted)).toBe(true);
  expect(observed.submissions().filter((submit) => submit.composing)).toHaveLength(0);
  await expect(peer).toHaveValue("REMOTE Shared source LOCAL");
  expect(physical()).toBe("REMOTE Shared source LOCAL");

  await peer.fill("PEER REMOTE Shared source LOCAL");
  await expect.poll(physical).toBe("PEER REMOTE Shared source LOCAL");
  await expect
    .poll(() =>
      observed.snapshots.some(
        (snapshot) =>
          snapshot.text === "PEER REMOTE Shared source LOCAL" && snapshot.composing && snapshot.via === "stream",
      ),
    )
    .toBe(true);
  await expect(native).toContainText("編集");
  expect(observed.submissions().filter((submit) => submit.composing)).toHaveLength(0);
  expect(observed.compositions().filter((event) => event.type === "compositionend")).toHaveLength(0);
  // Chromium commits its active IME composition through the input pipeline; no app state is changed directly.
  await cdp.send("Input.insertText", { text: "編集" });
  await expect.poll(() => observed.compositions().filter((event) => event.type === "compositionend").length).toBe(1);
  // Chromium's queued compositionend can be untrusted even on a plain contenteditable.
  // The trusted start/updates above prove this came through its actual IME input pipeline.
  expect(observed.compositions().find((event) => event.type === "compositionend")?.data).toBe("編集");
  await expect
    .poll(() => observed.submissions().some((submit) => submit.started === 1 && submit.ended === 1))
    .toBe(true);
  expect(observed.submissions().filter((submit) => submit.composing)).toHaveLength(0);
  await converges("PEER REMOTE Shared source LOCAL編集");
  await native.press("ControlOrMeta+z");
  await converges("PEER REMOTE Shared source LOCAL");
  await native.press("ControlOrMeta+Shift+z");
  await converges("PEER REMOTE Shared source LOCAL編集");
  await cdp.detach();
});
