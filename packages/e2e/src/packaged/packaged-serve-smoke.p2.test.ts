import { beforeAll, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionOwner, createExtensionPreparation } from "pstdio-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
// Native actions cover complete Kanban moves and independent schema dependencies.
// Native actions retain failed outcomes for the UI entry point to report.
// Includes boolean board/table rules with a stored false value.
// Also checks native harness controls and their structured values in packaged command handlers.
// Allocated files stay isolated for two publishers with the same package name.
import { expectPackagedNativeActions, writeNativeActionsExtension } from "./packaged-native-actions-smoke";
// Navigation metadata preserves tabless page presentation, panel views, slot replacements, caller-relative handoff and placeholder actions through the compiled host.
// scripts/verify/public-package-consumer.ts checks legacy hidden headers and explicit page/tab presentation in the built workbench.
// packaged-session-tools.p1.spec.ts checks draft/session/tool tab restoration across navigation and reload, creation, closure and New session tools.
// packaged-empty-panels.p2.spec.ts checks Home startup without tool cards and page-scoped headers through reload and immediate navigation.
// packaged-notes-page.p2.spec.ts checks Notes creation cards, Add actions, and page-owned Main tabs across navigation and reload.
import { expectPackagedNavigation, writeNavigationExtension } from "./packaged-navigation-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const BUILD_TIMEOUT = 180_000;

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

// extension-browser-install.p2.test.ts installs the cached Playwright package and visits a smoke page.

test("starts and stops an extension owner using the packaged executable and declared dependencies", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-extension-owner-"));
  const owner = createExtensionOwner({
    path: writeExtensionWithDependency(root),
    runtime: { executable: PACKAGED_BINARY_PATH, packaged: true },
  });
  try {
    const source = await owner.load();
    expect(owner.diagnostics).toEqual([]);
    expect(source?.manifest.id).toBe("test.dep-ext");
    expect(source?.definition.templates?.[0]?.id).toBe("packaged-asset");
    const pid = owner.pid;
    await owner.stop();
    expect(owner.pid).toBeUndefined();
    expect(pid).toBeGreaterThan(0);
    await expect(owner.load()).rejects.toMatchObject({ code: "extension_owner_stopped" });
  } finally {
    await owner.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("prepares source identities in a separate process using the packaged executable", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-extension-preparation-"));
  const preparation = createExtensionPreparation({ executable: PACKAGED_BINARY_PATH, packaged: true });
  try {
    const path = writeExtensionWithDependency(root);
    const key = await preparation.run("loadKey", path);
    expect(key.length).toBeGreaterThan(0);
    expect(preparation.pid).toBeGreaterThan(0);
    expect(preparation.pid).not.toBe(process.pid);
    await preparation.dispose();
    expect(preparation.pid).toBeUndefined();
  } finally {
    await preparation.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("packaged owner streams retain scoped callbacks and BYOB reader behavior", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-owner-stream-"));
  const path = writeExtensionWithDependency(root);
  writeFileSync(
    join(path, "extension.ts"),
    `import { marker } from 'test-dep/feature';
    export default { commands: [{ id: 'stream', run: (ctx) => {
      let sent = false;
      return new ReadableStream({ type: 'bytes', async pull(controller) {
        if (sent) { controller.close(); controller.byobRequest?.respond(0); return; }
        sent = true;
        controller.enqueue(new TextEncoder().encode(marker + ':' + await ctx.storage.get('key')));
      } });
    } }] };`,
  );
  const owner = createExtensionOwner({ path, runtime: { executable: PACKAGED_BINARY_PATH, packaged: true } });
  try {
    const source = await owner.load();
    const stream = (await source!.definition.commands![0]!.run(
      {
        storage: {
          get: async (key: string) => {
            expect(key).toBe("key");
            return "scoped";
          },
        },
      } as never,
      {},
    )) as unknown as ReadableStream<Uint8Array>;
    expect(stream).toBeInstanceOf(ReadableStream);
    const reader = stream.getReader({ mode: "byob" });
    const first = await reader.read(new Uint8Array(128));
    expect(new TextDecoder().decode(first.value)).toBe("loaded-via-exports-subpath:scoped");
    expect((await reader.read(new Uint8Array(128))).done).toBe(true);
    reader.releaseLock();
    expect(owner.inspect().pendingCalls).toBe(0);
  } finally {
    await owner.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("includes extension development, smoke test, browser setup and update commands", () => {
  const installBrowser = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "install-browser", "--help"], {
    encoding: "utf8",
  });
  expect(installBrowser.status).toBe(0);
  expect(installBrowser.stdout).toContain("extensions install-browser");
  const testResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "test", "--help"], { encoding: "utf8" });
  expect(testResult.status).toBe(0);
  const devResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "dev", "--help"], { encoding: "utf8" });
  const updateResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "update", "--help"], { encoding: "utf8" });

  expect(devResult.status).toBe(0);
  expect(devResult.stdout).toContain("extensions dev <source>");
  expect(updateResult.status).toBe(0);
  expect(updateResult.stdout).toContain("extensions update [name]");
});

test(
  "loads default extension dependencies, native actions and command-backed workspace choices",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const extensionSource = writeExtensionWithDependency(tempRoot, `^0.0.9 || ^${EXTENSION_API_VERSION}`);
      const installEnvironmentProbe = writeExtensionInstallEnvironmentProbe(tempRoot);
      const navigationProbe = writeNavigationExtension(tempRoot);
      const nativeActions = writeNativeActionsExtension(tempRoot);
      const otherNativeActions = writeNativeActionsExtension(join(tempRoot, "other-source"), "other");
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
          { source: extensionSource, installName: "dep-ext", skipInstall: true },
          { source: installEnvironmentProbe, installName: "install-env-probe" },
          { source: navigationProbe, installName: "navigation-probe" },
          { source: nativeActions, installName: "native-actions" },
          { source: otherNativeActions, installName: "other-native-actions" },
        ]),
        HTTPS_PROXY: "http://127.0.0.1:9",
        NPM_CONFIG_REGISTRY: "http://127.0.0.1:9",
        NPM_TOKEN: "registry-secret",
        GITHUB_TOKEN: "source-control-secret",
        OPENAI_API_KEY: "provider-secret",
      });
      child = started.child;

      const projectFolder = join(tempRoot, "project");
      mkdirSync(projectFolder, { recursive: true });
      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "packaged-extension-project" }, projectFolder)),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(extensionsRes.status).toBe(200);

      const body = (await extensionsRes.json()) as {
        extensions: Array<{ enabled: boolean; installName: string; name: string }>;
      };
      const extension = body.extensions.find((entry) => entry.installName === "dep-ext");

      expect(extension).toMatchObject({
        enabled: true,
        name: "dep-ext",
      });
      await expectPackagedNativeActions({
        projectFolder,
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
      await expectPackagedNavigation({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });

      // Even trusted dependency scripts must not run during an extension install.
      expect(existsSync(join(tempRoot, "install-env.json"))).toBe(false);
    } finally {
      if (child) {
        await stopProcess(child);
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);

test("packaged CLI includes automation and machine authentication", () => {
  const result = spawnSync(PACKAGED_BINARY_PATH, ["--help"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("pstdio automation [command]");
  expect(result.stdout).toContain("pstdio auth [command]");

  // Reads only this device's desktop app, so an empty home starts no runtime.
  const home = mkdtempSync(join(tmpdir(), "packaged-performance-"));
  const performance = spawnSync(PACKAGED_BINARY_PATH, ["performance"], {
    encoding: "utf8",
    env: { ...process.env, PSTDIO_HOME: home },
  });
  expect(performance.status).not.toBe(0);
  expect(performance.stdout).toBe("");
  expect(existsSync(join(home, "runtime.json"))).toBe(false);
  rmSync(home, { recursive: true, force: true });
});
