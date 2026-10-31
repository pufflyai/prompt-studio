import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, expect as browserExpect, chromium } from "@playwright/test";
import { createClient } from "@pstdio/sdk/client";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const waitFor = async (ready: () => Promise<boolean>) => {
  await browserExpect.poll(ready, { message: "Cloud project synchronization did not finish" }).toBe(true);
};
const signIn = async (client: ReturnType<typeof createClient>, origin: string) => {
  const login = new URL((await client.account.login(origin)).url);
  const callback = new URL(login.searchParams.get("callback")!);
  callback.searchParams.set("state", login.searchParams.get("state")!);
  callback.searchParams.set("code", "fixture-code");
  expect((await fetch(callback)).ok).toBe(true);
};

setupPackagedSmokeTests();
// Critical risk: another device's ready workspace can leave Notes without local files or its creation control.
test(
  "a downloaded cloud project opens Notes on this device and creates a note through its plus button",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "cloud-notes-onboarding-"));
    let peerCleanup: ReturnType<typeof createPackagedSyncPeer> | undefined;
    let firstCleanup: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    let secondCleanup: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    let browserCleanup: Browser | undefined;
    let completeRetry = () => {};
    const retryHeld = new Promise<void>((resolve) => {
      completeRetry = resolve;
    });
    let completeInitialSetup = () => {};
    const initialSetupHeld = new Promise<void>((resolve) => {
      completeInitialSetup = resolve;
    });
    try {
      const key = join(root, "key.pem");
      const cert = join(root, "cert.pem");
      const openssl = Bun.spawnSync([
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
      ]);
      expect(openssl.exitCode).toBe(0);
      const peer = createPackagedSyncPeer({ key: Bun.file(key), cert: Bun.file(cert) });
      peerCleanup = peer;
      const env = {
        NODE_EXTRA_CA_CERTS: cert,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
          {
            source: join(import.meta.dir, "../../../../extensions/pstdio-notes"),
            installName: "pstdio-notes",
            skipInstall: true,
          },
        ]),
      };
      const aHome = join(root, "a");
      const bHome = join(root, "b");
      await Promise.all([mkdir(aHome), mkdir(bHome)]);
      const first = await startPackagedServe(aHome, env);
      firstCleanup = first;
      const second = await startPackagedServe(bHome, env);
      secondCleanup = second;
      const a = createClient({ baseUrl: first.baseUrl, token: first.descriptor.token });
      const b = createClient({ baseUrl: second.baseUrl, token: second.descriptor.token });
      const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
      browserCleanup = browser;
      const sourceFolder = join(root, "source");
      const localFolder = join(root, "local");
      await Promise.all([mkdir(sourceFolder), mkdir(localFolder)]);
      const project = await a.projects.create(folderProjectInput({ name: "Cloud notes" }, sourceFolder));
      const seeded = await a.extensions.execute("pstdio.pstdio-notes.command.notes.create", {
        projectId: project.id,
        params: { title: "From device A" },
        source: "api",
      });
      expect(seeded.outcome.ok).toBe(true);
      await b.projects.create(folderProjectInput({ name: "Local project" }, localFolder));
      await signIn(a, peer.origin);
      await a.account.syncProject(project.id);
      await waitFor(async () => (await a.account.projectSyncStatus(project.id)).offlineReady);
      await signIn(b, peer.origin);
      await waitFor(async () => (await b.projects.query()).items.some((item) => item.id === project.id));
      await waitFor(async () => (await b.account.projectSyncStatus(project.id)).offlineReady);
      await waitFor(async () => {
        const response = await fetch(`${second.baseUrl}/v1/workspaces?project_id=${project.id}`, {
          headers: runtimeAuthorization(second.descriptor),
        });
        const workspaces = (await response.json()) as Array<{
          is_default: boolean;
          device?: unknown;
          root_path: string | null;
        }>;
        return workspaces.some((row) => row.is_default && row.device && row.root_path);
      });
      expect((await b.projects.folder(project.id)).path).toBeNull();
      const page = await browser.newPage();
      const opens: number[] = [];
      let downloaded = false;
      await page.route(`**/v1/account/projects/${project.id}/sync`, async (route) => {
        if (downloaded) return route.continue();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ state: "needs-attention", offlineReady: false }),
        });
      });
      await page.route(`**/v1/account/projects/${project.id}/retry`, (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "The sync retry failed." }),
        }),
      );
      let attempts = 0;
      await page.route(`**/v1/projects/${project.id}/open`, async (route) => {
        if (++attempts === 1) {
          await initialSetupHeld;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "The project folder could not be created." }),
          });
          return;
        }
        await retryHeld;
        await route.continue();
      });
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === `/v1/projects/${project.id}/open`) opens.push(response.status());
      });
      await page.addInitScript(() => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.removeItem("dashboard-wb2:selected-project:global");
      });
      await signInBrowser(page, { origin: second.baseUrl, token: second.descriptor.token });
      await page
        .getByRole("dialog", { name: "Projects", exact: true })
        .getByRole("option", { name: "Cloud notes", exact: true })
        .click();
      const opening = page.getByRole("dialog", { name: /^Opening / });
      await opening.getByRole("button", { name: "Retry", exact: true }).click();
      await browserExpect(opening.getByText("The sync retry failed.", { exact: true })).toBeVisible();
      downloaded = true;
      await browserExpect.poll(() => attempts).toBe(1);
      await browserExpect(opening.getByText("The sync retry failed.", { exact: true })).toHaveCount(0);
      await browserExpect(opening.getByRole("status")).toBeVisible();
      completeInitialSetup();
      await browserExpect(opening.getByText("The project folder could not be created.", { exact: true })).toBeVisible();
      await opening.getByRole("button", { name: "Retry", exact: true }).click();
      await browserExpect(opening.getByText("The project folder could not be created.", { exact: true })).toHaveCount(
        0,
      );
      await browserExpect(opening.getByText("The sync retry failed.", { exact: true })).toHaveCount(0);
      await browserExpect(opening.getByRole("status")).toBeVisible();
      completeRetry();
      await browserExpect.poll(() => opens).toContain(200);
      expect((await b.projects.folder(project.id)).path).toBeTruthy();
      await browserExpect(page.getByRole("dialog", { name: /^Opening / })).toHaveCount(0);
      const sidebar = page.locator('[data-workbench-region="sidenav"]');
      await sidebar.getByRole("option", { name: "Notes", exact: true }).click();
      await browserExpect(sidebar.getByRole("option", { name: "From device A", exact: true })).toBeVisible();
      await sidebar.getByRole("button", { name: "New note", exact: true }).click();
      const editor = page.getByTestId("content-editable").filter({ visible: true }).first();
      await browserExpect(editor).toBeVisible();
      await editor.fill("Created on device B");
      await browserExpect(sidebar.getByRole("option", { name: "Created on device B", exact: true })).toBeVisible();
      await page.reload();
      await browserExpect(editor).toContainText("Created on device B");
      await waitFor(async () => {
        const files = new Bun.Glob("*/content.md").scan({
          cwd: join(sourceFolder, ".pstdio/extension-storage/pstdio.pstdio-notes/documents"),
        });
        for await (const file of files)
          if (
            (
              await Bun.file(join(sourceFolder, ".pstdio/extension-storage/pstdio.pstdio-notes/documents", file)).text()
            ).includes("Created on device B")
          )
            return true;
        return false;
      });
      await page.screenshot({ path: join(import.meta.dir, "../../test-results/cloud-notes-onboarding.png") });
    } finally {
      completeInitialSetup();
      completeRetry();
      const cleanup = await Promise.allSettled([
        browserCleanup?.close(),
        firstCleanup && stopProcess(firstCleanup.child),
        secondCleanup && stopProcess(secondCleanup.child),
        peerCleanup?.stop(),
      ]);
      await rm(root, { recursive: true, force: true });
      const errors = cleanup.filter((result) => result.status === "rejected").map((result) => result.reason);
      expect(errors, "Cloud Notes test cleanup failed").toEqual([]);
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
