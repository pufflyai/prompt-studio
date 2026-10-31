import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace, openUpdate } from "pstdio-sync/encryption";
import { folderProjectInput } from "../helpers/folder-project";
import { verifyNativePublicTextEditor, verifyPublicTextEditor } from "../helpers/verify-public-text-editor";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, test as base, chromium, expect, type Route } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import {
  type PublicTextDevice,
  publicTextSyncFixture,
  readPublicTextCopy,
  seedPublicTextDevice,
  signInPublicTextDevice,
} from "./packaged-public-text-sync.fixture";
import { signInBrowser, stopProcess } from "./packaged-serve-helpers";
import { packagedProjectKey } from "./packaged-sync-project-key.fixture";

interface Resources {
  root: string;
  children: Set<ChildProcess>;
  browser?: Browser;
  fixture?: Awaited<ReturnType<typeof publicTextSyncFixture>>;
}

const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use) => {
    const resources: Resources = {
      root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-public-text-sync-"))),
      children: new Set(),
    };
    const failures: unknown[] = [];
    try {
      await use(resources);
    } catch (error) {
      failures.push(error);
    }
    // Teardown is owned by Playwright even when the test body remains blocked at its deadline.
    await stopPendingTestProcesses().catch((error) => failures.push(error));
    const results = await Promise.allSettled([
      resources.browser?.close(),
      ...[...resources.children].map(stopProcess),
      resources.fixture?.peer.close(),
    ]);
    for (const result of results) if (result.status === "rejected") failures.push(result.reason);
    try {
      rmSync(resources.root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) throw new AggregateError(failures, "Public text fixture cleanup failed");
  },
});

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("native Markdown and an installed public editor converge across encrypted hosts and recover edits made while the home host is stopped", async ({
  resources,
}) => {
  const { root, children } = resources;
  const fixture = await publicTextSyncFixture(root);
  resources.fixture = fixture;
  const start = async (name: string) => {
    const device = await fixture.startDevice(name);
    children.add(device.host.child);
    return device;
  };
  let first = await start("first-home");
  const second = await start("second-home");
  expect(first.host.child.pid).not.toBe(second.host.child.pid);
  expect(first.home).not.toBe(second.home);
  const firstFolder = join(root, "first-folder");
  const secondFolder = join(root, "second-folder");
  mkdirSync(firstFolder);
  mkdirSync(secondFolder);
  const project = await first.client.projects.create(folderProjectInput({ name: "Public text sync" }, firstFolder));
  await seedPublicTextDevice(first, project.id);
  await signInPublicTextDevice(first, fixture.peer.origin);
  await first.client.account.syncProject(project.id);
  await expect.poll(async () => (await first.client.account.projectSyncStatus(project.id)).state).toBe("synced");
  await signInPublicTextDevice(second, fixture.peer.origin);
  await expect
    .poll(async () => (await second.client.projects.query()).items.some((item) => item.id === project.id))
    .toBe(true);
  await second.client.projects.chooseFolder(project.id, { path: secondFolder, clone: false });
  await expect.poll(async () => (await second.client.account.projectSyncStatus(project.id)).state).toBe("synced");
  await expect
    .poll(() => readPublicTextCopy(secondFolder, "paper.public-text-source", "selected.md"))
    .toBe("Shared source");

  const browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
  resources.browser = browser;
  const open = async (device: PublicTextDevice, value: string, native: boolean) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    const page = await context.newPage();
    await signInBrowser(page, device.host.descriptor);
    const route = native ? "native" : "shared";
    await page.goto(`${device.host.baseUrl}/projects/${project.id}/extensions/paper.public-text-source/${route}`);
    const editor = native
      ? await verifyNativePublicTextEditor(page, value)
      : await verifyPublicTextEditor(page, true, value);
    const readText = () => (native ? editor.textContent() : editor.inputValue());
    return { context, page, editor, readText };
  };
  let left = await open(first, "Shared source", true);
  const right = await open(second, "Shared source", false);
  const gate = Promise.withResolvers<void>();
  const held = new Set<string>();
  const admit = (name: string) => async (route: Route) => {
    if (route.request().postDataJSON()?.request?.operation === "submit" && !held.has(name)) {
      held.add(name);
      await gate.promise;
    }
    await route.continue();
  };
  const admitNative = admit("native");
  const admitInstalled = admit("installed");
  await left.context.route("**/text-editing/request", admitNative);
  await right.context.route("**/text-editing/request", admitInstalled);
  try {
    // Both presentations must submit through the public API against their common received history.
    await Promise.all([
      left.editor.fill("public-two-host-secret: Shared source"),
      right.editor.fill("Shared source: remote"),
    ]);
    await expect.poll(() => held.size).toBe(2);
  } finally {
    gate.resolve();
  }
  const online = "public-two-host-secret: Shared source: remote";
  await expect.poll(left.readText).toBe(online);
  await expect.poll(right.readText).toBe(online);
  await left.context.unroute("**/text-editing/request", admitNative);
  await right.context.unroute("**/text-editing/request", admitInstalled);

  await fixture.peer.stop();
  for (const device of [first, second])
    await expect.poll(async () => (await device.client.account.projectSyncStatus(project.id)).state).toBe("offline");
  await Promise.all([left.editor.fill(`offline first: ${online}`), right.editor.fill(`${online}: offline second`)]);
  await expect.poll(left.readText).toBe(`offline first: ${online}`);
  await expect.poll(right.readText).toBe(`${online}: offline second`);
  await expect
    .poll(() => readPublicTextCopy(firstFolder, "paper.public-text-source", "selected.md"))
    .toBe(`offline first: ${online}`);
  await expect
    .poll(() => readPublicTextCopy(secondFolder, "paper.public-text-source", "selected.md"))
    .toBe(`${online}: offline second`);
  await fixture.peer.restart();
  const merged = `offline first: ${online}: offline second`;
  await expect.poll(left.readText).toBe(merged);
  await expect.poll(right.readText).toBe(merged);
  for (const folder of [firstFolder, secondFolder])
    await expect.poll(() => readPublicTextCopy(folder, "paper.public-text-source", "selected.md")).toBe(merged);

  await left.context.close();
  await stopProcess(first.host.child);
  children.delete(first.host.child);
  expect(first.host.child.exitCode !== null || first.host.child.signalCode !== null).toBe(true);
  const stopped = `${merged}: while home stopped`;
  await right.editor.fill(stopped);
  await expect.poll(() => readPublicTextCopy(secondFolder, "paper.public-text-source", "selected.md")).toBe(stopped);
  await expect.poll(async () => (await second.client.account.projectSyncStatus(project.id)).state).toBe("synced");
  first = await start("first-home");
  await expect.poll(async () => (await first.client.account.projectSyncStatus(project.id)).state).toBe("synced");
  left = await open(first, stopped, true);
  await expect.poll(left.readText).toBe(stopped);
  await expect.poll(() => readPublicTextCopy(firstFolder, "paper.public-text-source", "selected.md")).toBe(stopped);

  for (const folder of [firstFolder, secondFolder]) {
    expect(readPublicTextCopy(folder, "paper.public-text-source", "private.md")).toBe("Source owner private text");
    expect(readPublicTextCopy(folder, "ink.public-text-editor", "own.md")).toBe("Editor source");
  }
  const contents = await fixture.peer.inspect();
  const documents = new Map(contents.documents);
  const payloads = [...documents.values()].flatMap((document) => [
    ...(document.payload ? [Buffer.from(document.payload, "base64")] : []),
    ...document.updates.map((update) => Buffer.from(String(update.payload), "base64")),
  ]);
  expect(payloads.length).toBeGreaterThan(0);
  for (const bytes of [...payloads, ...contents.blobs.map((value) => Buffer.from(value, "base64"))])
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("public-two-host-secret");
  const space = await createSyncSpace({ projectId: project.id, spaceOwner: null, keys: [packagedProjectKey] });
  const streamId = await space.documentId(JSON.stringify(["paper.public-text-source", "record-stream"]));
  const stream = documents.get(`~${streamId}`);
  expect(stream?.updates.length).toBeGreaterThan(0);
  const cleartext: string[] = [];
  for (const update of stream!.updates) {
    const envelope = { updateId: String(update.updateId), payload: String(update.payload) };
    cleartext.push(Buffer.from(await openUpdate(space, streamId, envelope)).toString("latin1"));
  }
  expect(cleartext.some((bytes) => bytes.includes("public-two-host-secret"))).toBe(true);
  const wrongSpace = await createSyncSpace({
    projectId: project.id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "C".repeat(43) }],
  });
  const sample = stream!.updates[0]!;
  await expect(
    openUpdate(wrongSpace, streamId, { updateId: String(sample.updateId), payload: String(sample.payload) }),
  ).rejects.toThrow();
});
