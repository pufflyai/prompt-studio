import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectManagedWebviewBuildInputs } from "../../authoring/extension-webview-build-source";
import { createResourceCoordinator } from "../resource-coordinator";
import {
  createExtensionPreparation,
  disposeExtensionPreparation,
  extensionPreparationPid,
  prepareExtensionWork,
} from "./supervisor";

test("shutdown removes preparation still waiting for resources without spawning a child", async () => {
  const resources = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 0 }) });
  const preparation = createExtensionPreparation(undefined, resources);
  try {
    const loading = preparation.run("sourceHash", "unused-before-admission").catch((error) => error);
    await Bun.sleep(0);
    expect(resources.snapshot().queued).toBe(1);
    expect(preparation.pid).toBeUndefined();
    await preparation.dispose();
    expect(await loading).toBeInstanceOf(Error);
    expect(resources.snapshot().queued).toBe(0);
    expect(preparation.pid).toBeUndefined();
  } finally {
    await preparation.dispose();
    resources.dispose();
  }
});

test("cancelling preparation reaps the process before rejecting and permits a later explicit request", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-cancel-preparation-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "cancelled" }));
  writeFileSync(join(root, "extension.ts"), "export default {};");
  const signal = new AbortController();
  try {
    const work = prepareExtensionWork("sourceHash", root, signal.signal);
    await Bun.sleep(0);
    const pid = extensionPreparationPid();
    expect(pid).toBeGreaterThan(0);
    signal.abort();
    await expect(work).rejects.toThrow("preparation stopped");
    expect(extensionPreparationPid()).toBeUndefined();
    expect(() => process.kill(pid!, 0)).toThrow();
    expect((await prepareExtensionWork("sourceHash", root)).length).toBeGreaterThan(0);
  } finally {
    await disposeExtensionPreparation();
    rmSync(root, { recursive: true, force: true });
  }
});

test("prepares the production import graph in a separate process with unchanged signatures", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-preparation-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "prepared" }));
  writeFileSync(join(root, "main.ts"), "import { revision } from './shared'; console.log(revision);");
  writeFileSync(join(root, "shared.ts"), "export const revision = 1;");
  const input = {
    entryPath: join(root, "main.ts"),
    packagePath: root,
    installName: "prepared",
    packageName: "prepared",
  };
  try {
    const first = await prepareExtensionWork("inspectWebview", input);
    expect(extensionPreparationPid()).not.toBe(process.pid);
    expect(first).toEqual(inspectManagedWebviewBuildInputs(input));
    writeFileSync(join(root, "shared.ts"), "export const revision = 2;");
    const changed = await prepareExtensionWork("inspectWebview", input);
    expect(changed.signature).not.toBe(first.signature);
    expect(changed).toEqual(inspectManagedWebviewBuildInputs(input));
    await disposeExtensionPreparation();
    expect(extensionPreparationPid()).toBeUndefined();
  } finally {
    await disposeExtensionPreparation();
    rmSync(root, { recursive: true, force: true });
  }
});
