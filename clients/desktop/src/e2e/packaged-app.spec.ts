import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createPackagedHome,
  desktopVersion,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  readDescriptor,
  removePackagedHome,
  runPackagedCli,
  waitForDescriptor,
  waitForExit,
} from "./packaged-app-helpers";

const createProjectThroughBrowser = (app: PackagedApp, name: string) =>
  app.page.evaluate(async (projectName) => {
    const response = await fetch("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    return { body: (await response.json()) as { id?: string; name?: string }, status: response.status };
  }, name);

test("proves cold packaged startup and both authenticated transport paths", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    testInfo.annotations.push({ type: "cold-start-ms", description: String(app.readyInMs) });
    expect(app.readyInMs).toBeLessThan(8_000);
    expect(new URL(app.runtime.origin).hostname).toBe("127.0.0.1");
    expect(app.runtime.ownerType).toBe("desktop");

    expect((await fetch(`${app.runtime.origin}/runtime/ready`)).status).toBe(401);
    expect(
      (
        await fetch(`${app.runtime.origin}/v1/projects`, {
          headers: { authorization: `Bearer ${app.runtime.token}`, origin: "https://example.invalid" },
        })
      ).status,
    ).toBe(403);

    expect(await createProjectThroughBrowser(app, "Packaged transport project")).toEqual({
      body: expect.objectContaining({ name: "Packaged transport project" }),
      status: 201,
    });
    expect(await app.page.evaluate(() => document.cookie)).toBe("");
    expect(await app.page.content()).not.toContain(app.runtime.token);
    expect(app.page.url()).not.toContain(app.runtime.token);
    expect(
      await app.page.evaluate(() => {
        const encodedConfig = document.querySelector<HTMLMetaElement>('meta[name="pstdio-config"]')?.content;
        return encodedConfig ? (JSON.parse(decodeURIComponent(encodedConfig)) as { version?: string }).version : null;
      }),
    ).toBe(desktopVersion);

    const list = await runPackagedCli(home, ["projects", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("Packaged transport project");

    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0, stdout: expect.stringContaining("Runtime stopped.") });
    expect(existsSync(join(home, "runtime.json"))).toBe(false);
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});

test("promotes ownership, detaches, and preserves data through a warm relaunch", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let first: PackagedApp | null = null;
  let second: PackagedApp | null = null;
  try {
    first = await launchPackagedApp(home);
    const created = await createProjectThroughBrowser(first, "Relaunch persistence project");
    expect(created).toMatchObject({ status: 201 });
    const projectId = created.body.id;
    if (!projectId) throw new Error("Packaged project creation did not return an id");
    await first.page.getByRole("option", { name: /Workspaces/ }).click();
    await expect(first.page.getByRole("option", { name: /Workspaces/ })).toHaveAttribute("aria-selected", "true");
    await expect(first.page.getByLabel("Main").getByRole("heading", { name: "No workspaces yet" })).toBeVisible();
    await expect
      .poll(() => first?.page.evaluate(() => window.promptStudioDesktop.getWorkbenchState()))
      .toMatchObject({ selectedProjectId: projectId });
    const firstState = await first.page.evaluate(() => window.promptStudioDesktop.getWorkbenchState());
    const lastResource = firstState.lastResources[projectId];
    expect(JSON.parse(lastResource ?? "null")).toMatchObject({
      id: "workspaces",
      kind: "dashboard-view",
    });

    const originalPid = first.runtime.pid;
    expect(await runPackagedCli(home, ["serve"])).toMatchObject({ exitCode: 0 });
    const persistent = await waitForDescriptor(home, (descriptor) => descriptor.ownerType === "persistent");
    expect(persistent.pid).toBe(originalPid);

    await first.page.evaluate(() => void window.promptStudioDesktop.quitApp());
    await waitForExit(first.child);
    expect(
      (
        await fetch(`${persistent.origin}/runtime/ready`, {
          headers: { authorization: `Bearer ${persistent.token}` },
        })
      ).ok,
    ).toBe(true);
    await first.browser.close();
    first = null;

    second = await launchPackagedApp(home);
    testInfo.annotations.push({ type: "warm-attach-ms", description: String(second.readyInMs) });
    expect(second.readyInMs).toBeLessThan(3_000);
    expect(second.runtime.pid).toBe(originalPid);
    expect(second.runtime.ownerType).toBe("persistent");
    expect(await second.page.evaluate(() => window.promptStudioDesktop.getWorkbenchState())).toMatchObject({
      lastResources: { [projectId]: lastResource },
      selectedProjectId: projectId,
    });
    expect(
      await second.page.evaluate(async () => (await (await fetch("/v1/projects")).json()) as Array<{ name: string }>),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Relaunch persistence project" })]));
    await expect(second.page.getByRole("option", { name: /Workspaces/ })).toHaveAttribute("aria-selected", "true");
    await expect(second.page.getByLabel("Main").getByRole("heading", { name: "No workspaces yet" })).toBeVisible();

    const close = runPackagedCli(home, ["close"]);
    await waitForExit(second.child);
    expect(await close).toMatchObject({ exitCode: 0 });
    expect(readDescriptor(home)).toBeNull();
  } finally {
    await disposePackagedApp(first);
    await disposePackagedApp(second);
    removePackagedHome(home);
  }
});

test("shows recovery promptly after a sidecar crash and retries without relaunching Electron", async ({
  browserName: _browserName,
}, testInfo) => {
  const home = createPackagedHome();
  let app: PackagedApp | null = null;
  try {
    app = await launchPackagedApp(home);
    const originalInstanceId = app.runtime.instanceId;
    const crashedAt = Date.now();
    process.kill(app.runtime.pid, process.platform === "win32" ? undefined : "SIGKILL");
    await expect(app.page.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
    const recoveryInMs = Date.now() - crashedAt;
    testInfo.annotations.push({ type: "recovery-ui-ms", description: String(recoveryInMs) });
    expect(recoveryInMs).toBeLessThan(500);

    await app.page.getByRole("button", { name: "Retry" }).click();
    const replacement = await waitForDescriptor(home, (descriptor) => descriptor.instanceId !== originalInstanceId);
    await app.page.waitForURL(`${replacement.origin}/`);
    await expect(app.page.locator("#root")).not.toBeEmpty();

    const close = runPackagedCli(home, ["close"]);
    await waitForExit(app.child);
    expect(await close).toMatchObject({ exitCode: 0 });
  } finally {
    await disposePackagedApp(app);
    removePackagedHome(home);
  }
});
