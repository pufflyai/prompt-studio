import { join } from "node:path";
import { expect } from "@playwright/test";
import { discoverRuntime } from "pstdio/runtime";
import { type PackagedApp, waitForDescriptor } from "./packaged-app-helpers";

export const crashPackagedRuntime = (pid: number) =>
  process.kill(pid, process.platform === "win32" ? undefined : "SIGKILL");

export const waitForAutomaticRecovery = async (app: PackagedApp) => {
  const replacement = await waitForDescriptor(app.home, async (runtime) => {
    if (runtime.instanceId === app.runtime.instanceId) return false;
    // Publishing a descriptor does not mean the replacement finished opening its database.
    const discovery = await discoverRuntime(join(app.home, "runtime.json"));
    return discovery.state === "healthy" && discovery.descriptor.instanceId === runtime.instanceId;
  });
  await expect
    .poll(() => app.lifecyclePage.evaluate(() => window.promptStudioDesktop.getStartupState()))
    .toMatchObject({
      kind: "workbench",
      runtime: { instanceId: replacement.instanceId },
    });
  await app.page.waitForURL(`${replacement.origin}/**`);
  await expect(app.page.locator("#root")).not.toBeEmpty();
  app.runtime = replacement;
  return replacement;
};
