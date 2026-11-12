import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { type Browser, expect, test } from "../scripts/playwright-test";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import {
  marmaladeCommand as command,
  marmaladeFrames as frames,
  openMarmalade as open,
  readMarmaladePresentation as presentation,
  observeMarmaladeReads as reads,
} from "./packaged-marmalade.fixture";
import { projectSyncFixture } from "./packaged-project-sync.fixture";
import { signInPublicTextDevice } from "./packaged-public-text-sync.fixture";
import { signInBrowser, stopProcess } from "./packaged-serve-helpers";

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("five Marmalade views retain shared presentation across windows, encrypted hosts, project return and restart", async ({
  playwright,
}, testInfo) => {
  // Critical: an old retained presentation must never overwrite a collaborator's accepted project state.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-marmalade-sync-")));
  const children = new Set<ChildProcess>();
  let fixture: Awaited<ReturnType<typeof projectSyncFixture>> | undefined;
  let browser: Browser | undefined;
  const observations: Record<string, unknown> = {};
  const failures: unknown[] = [];
  try {
    fixture = await projectSyncFixture(root, e2eExtensions("extension-lab", "pstdio-workspaces", "pstdio-home"));
    const start = async (name: string) => {
      const device = await fixture!.startDevice(name);
      children.add(device.host.child);
      return device;
    };
    let first = await start("first-home");
    const second = await start("second-home");
    expect(first.home).not.toBe(second.home);
    expect(first.host.child.pid).not.toBe(second.host.child.pid);
    const folders = [join(root, "first-project"), join(root, "second-project"), join(root, "other-project")];
    for (const folder of folders) mkdirSync(folder);
    const project = await first.client.projects.create(folderProjectInput({ name: "Shared Marmalade" }, folders[0]!));
    const other = await first.client.projects.create(folderProjectInput({ name: "Other Marmalade" }, folders[2]!));
    await command(first, project.id, "marmalade.session.execute", { action: { type: "reset" } });
    await command(first, other.id, "marmalade.session.execute", { action: { type: "reset" } });
    await signInPublicTextDevice(first, fixture.peer.origin);
    await first.client.account.syncProject(project.id);
    await expect.poll(async () => (await first.client.account.projectSyncStatus(project.id)).state).toBe("synced");
    await signInPublicTextDevice(second, fixture.peer.origin);
    await expect
      .poll(async () => (await second.client.projects.query()).items.some((item) => item.id === project.id))
      .toBe(true);
    await second.client.projects.chooseFolder(project.id, { path: folders[1]!, clone: false });
    await expect.poll(async () => (await second.client.account.projectSyncStatus(project.id)).state).toBe("synced");
    browser = await playwright.chromium.launch({ headless: true, ...PACKAGED_DASHBOARD_BROWSER });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const remoteContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    for (const current of [context, remoteContext])
      await current.addInitScript(() => {
        if (window === window.top) localStorage.setItem("onboarding-complete", "true");
      });
    const local = await context.newPage(),
      peerWindow = await context.newPage(),
      remote = await remoteContext.newPage();
    await signInBrowser(local, first.host.descriptor);
    await signInBrowser(remote, second.host.descriptor);
    const localReads = reads(local),
      windowReads = reads(peerWindow),
      remoteReads = reads(remote);
    await open(local, first, project.id);
    await open(peerWindow, first, project.id);
    await open(remote, second, project.id);
    expect([localReads.length, windowReads.length, remoteReads.length]).toEqual([1, 1, 1]);

    await frames(local).rail.getByRole("button", { name: "Hand tool", exact: true }).click();
    for (const page of [local, peerWindow, remote])
      await expect(frames(page).rail.getByRole("button", { name: "Hand tool", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    await command(second, project.id, "marmalade.session.execute", { action: { type: "select", ids: ["credit"] } });
    for (const page of [local, peerWindow, remote])
      await expect(frames(page).inspector.getByRole("option", { name: "Credit", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    await command(second, project.id, "marmalade.session.execute", {
      action: { type: "viewport", zoom: 0.75, pan: { x: 32, y: 18 } },
    });
    for (const page of [local, peerWindow, remote]) {
      await expect(frames(page).status.getByText("75%", { exact: true })).toBeVisible();
      await expect(frames(page).canvas.locator('svg[aria-label="Marmalade document canvas"] > g')).toHaveAttribute(
        "transform",
        "translate(32 18) scale(0.75)",
      );
    }
    expect([localReads.length, windowReads.length, remoteReads.length]).toEqual([1, 1, 1]);

    // The current navigation changes project without replacing the document or iframe cache authority.
    await frames(local).nav.getByRole("button", { name: "Back to project", exact: true }).click();
    await local.getByRole("button", { name: "Switch project", exact: true }).click();
    await local.getByRole("dialog", { name: "Projects", exact: true }).getByText(other.name, { exact: true }).click();
    await local.getByRole("option", { name: "Marmalade", exact: true }).click();
    await expect(frames(local).rail.getByRole("button", { name: "Move tool", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localReads).toHaveLength(2);
    await command(second, project.id, "marmalade.session.execute", { action: { type: "tool", tool: "brush" } });
    await expect.poll(async () => (await presentation(first, project.id)).tool).toBe("brush");
    await frames(local).nav.getByRole("button", { name: "Back to project", exact: true }).click();
    await local.getByRole("button", { name: "Switch project", exact: true }).click();
    await local.getByRole("dialog", { name: "Projects", exact: true }).getByText(project.name, { exact: true }).click();
    await local.getByRole("option", { name: "Marmalade", exact: true }).click();
    await expect(frames(local).rail.getByRole("button", { name: "Brush tool", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(frames(local).status.getByText("75%", { exact: true })).toBeVisible();
    expect(localReads).toHaveLength(2);
    expect((await presentation(first, other.id)).tool).toBe("move");

    await command(second, project.id, "marmalade.session.execute", {
      action: { type: "text", id: "credit", text: "Accepted across devices" },
    });
    for (const page of [local, peerWindow, remote])
      await expect(frames(page).canvas.getByText("Accepted across devices", { exact: true })).toBeVisible();
    await command(second, project.id, "marmalade.session.execute", { action: { type: "select", ids: ["caption"] } });
    await command(second, project.id, "marmalade.session.execute", { action: { type: "expand", id: "caption" } });
    for (const page of [local, peerWindow, remote])
      await expect(frames(page).inspector.getByRole("button", { name: "Expand group", exact: true })).toBeVisible();
    expect((await presentation(first, project.id)).expandedIds).toEqual([]);
    await local.reload();
    await expect(frames(local).canvas.getByText("Accepted across devices", { exact: true })).toBeVisible();
    await expect(frames(local).rail.getByRole("button", { name: "Brush tool", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(frames(local).inspector.getByRole("option", { name: "Caption", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(frames(local).status.getByText("75%", { exact: true })).toBeVisible();
    await expect(frames(local).inspector.getByRole("button", { name: "Expand group", exact: true })).toBeVisible();
    const accepted = await presentation(first, project.id);
    await local.close();
    await peerWindow.close();
    const stopped = first.host.child;
    await stopProcess(stopped);
    children.delete(stopped);
    // A genuinely new process reopens the same durable app home and catches up through project sync.
    await command(second, project.id, "marmalade.session.execute", { action: { type: "tool", tool: "ellipse" } });
    first = await start("first-home");
    expect(first.host.child.pid).not.toBe(stopped.pid);
    await expect.poll(async () => (await presentation(first, project.id)).tool).toBe("ellipse");
    const restarted = await context.newPage();
    await signInBrowser(restarted, first.host.descriptor);
    await open(restarted, first, project.id);
    await expect(frames(restarted).rail.getByRole("button", { name: "Ellipse tool", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(frames(restarted).canvas.getByText("Accepted across devices", { exact: true })).toBeVisible();
    await expect(frames(restarted).status.getByText("75%", { exact: true })).toBeVisible();
    expect(await presentation(first, project.id)).toEqual({ ...accepted, tool: "ellipse" });
    observations.topology = {
      hosts: 2,
      appHomes: 2,
      localWindows: 2,
      remoteWindows: 1,
      viewsPerWindow: 5,
      account: "controlled authenticated owner",
      encryptedProjectSync: true,
    };
    observations.readsBeforeReload = { local: 2, otherLocalWindow: windowReads.length, remote: remoteReads.length };
    observations.restoredPresentation = await presentation(first, project.id);
  } catch (error) {
    failures.push(error);
  } finally {
    const stopped = await Promise.allSettled([
      testInfo.attach("marmalade-sync", {
        body: JSON.stringify(observations, null, 2),
        contentType: "application/json",
      }),
      browser?.close(),
      ...[...children].map(stopProcess),
      fixture?.peer.close(),
    ]);
    for (const result of stopped) if (result.status === "rejected") failures.push(result.reason);
    try {
      rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "Marmalade sync qualification failed");
});
