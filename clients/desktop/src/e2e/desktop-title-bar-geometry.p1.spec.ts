import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { startActiveRuntime } from "./active-runtime-fixture";
import { waitForLifecyclePage, waitForWorkbenchPage } from "./desktop-pages";
import { expectTitleBarGeometry } from "./title-bar-geometry";

const require = createRequire(import.meta.url);
const cleanup: Array<() => void | Promise<void>> = [];

test.afterEach(async () => {
  for (const action of cleanup.reverse()) await action();
  cleanup.length = 0;
});

test("keeps embedded workbench controls clear of the native window buttons", async () => {
  test.skip(process.platform === "darwin", "macOS reserves its traffic-light inset separately");
  const { home, descriptor } = await startActiveRuntime(cleanup, {
    refuseFirstForcedShutdown: false,
    holdDashboard: false,
  });
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: require("electron") as string,
    args: [resolve(import.meta.dirname, "../../dist/main.js"), `--user-data-dir=${join(home, "profile")}`],
    env: { ...env, PSTDIO_HOME: home },
  });
  cleanup.push(async () => {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
  });
  const lifecycle = await waitForLifecyclePage(app.context());
  const workbench = await waitForWorkbenchPage(lifecycle, descriptor.origin);
  await expect(workbench.getByText("Owned Prompt Studio dashboard")).toBeVisible();
  await expectTitleBarGeometry(app, workbench, lifecycle);
});
