import { expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallations } from "../../services/extension-installations";
import { installDefaultExtensions, installMissingDefaultExtensions } from "./default-extensions";
import { installed, writeExtension } from "./default-extensions-test-fixtures";

test("keeps replacing development defaults from their local sources", async () => {
  const home = mkdtempSync(join(tmpdir(), "default-extensions-development-"));
  const target = join(home, "extensions", "pstdio-skills");
  writeExtension(target, "pstdio-skills", "user");
  mkdirSync(join(target, "node_modules"));
  const install = mock(async () => installed);
  try {
    await installDefaultExtensions({
      env: { PSTDIO_HOME: home, PSTDIO_DEFAULT_EXTENSIONS: '["pstdio-skills"]' },
      installExtensionSource: install,
    });
    expect(install).toHaveBeenCalledWith(expect.objectContaining({ force: true, installName: "pstdio-skills" }));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test.each(["named", "local"])("uses installed %s defaults after an earlier setup finishes", async (kind) => {
  const root = mkdtempSync(join(tmpdir(), "default-extensions-reuse-"));
  const home = join(root, "home");
  const source = join(root, "source");
  const target = join(home, "extensions", "default-tool");
  writeExtension(source, "default-tool", "user");
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const prepareSharedCheckout = mock(async () => ({
    prepareNamedSource: async () => ({ path: source, ref: "first-release" }),
    cleanup: () => {},
  }));
  const input = {
    config: {
      defaultExtensions: [kind === "named" ? "default-tool" : { source, installName: "default-tool", force: true }],
    },
    env: { PSTDIO_HOME: home },
    prepareSharedCheckout,
    installExtensionSource: async () => {
      started.resolve();
      await released.promise;
      writeExtension(target, "default-tool", "user");
      mkdirSync(join(target, "node_modules"), { recursive: true });
      return { ...installed, installName: "default-tool", targetPath: target };
    },
  };
  try {
    const startup = installDefaultExtensions(input);
    await started.promise;
    const project = installMissingDefaultExtensions({
      ...input,
      prepareSharedCheckout: async () => {
        throw new Error("Project setup must not fetch installed defaults again");
      },
    });
    released.resolve();
    expect((await startup).map((extension) => extension.installName)).toEqual(["default-tool"]);
    expect(await project).toEqual([]);
    expect(prepareSharedCheckout).toHaveBeenCalledTimes(kind === "named" ? 1 : 0);
  } finally {
    released.resolve();
    rmSync(root, { recursive: true, force: true });
  }
});

test.each(["missing dependencies", "forced replacement"])("keeps setup for %s", async (reason) => {
  const root = mkdtempSync(join(tmpdir(), "default-extensions-repair-"));
  const home = join(root, "home");
  const target = join(home, "extensions", "default-tool");
  writeExtension(target, "default-tool", "user");
  if (reason === "forced replacement") mkdirSync(join(target, "node_modules"));
  const install = mock(async () => installed);
  const prepareSharedCheckout = mock(async () => ({
    prepareNamedSource: async () => ({ path: target, ref: "release" }),
    cleanup: () => {},
  }));
  try {
    await installDefaultExtensions({
      config: { defaultExtensions: [{ source: "default-tool", force: reason === "forced replacement" }] },
      env: { PSTDIO_HOME: home },
      installExtensionSource: install,
      prepareSharedCheckout,
    });
    expect(prepareSharedCheckout).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each(["checkout", "install"])("reacquires sources when retrying a failed %s", async (failure) => {
  const root = mkdtempSync(join(tmpdir(), "default-extensions-retry-"));
  const jobs = createExtensionInstallations();
  const caller = new AbortController();
  let checkouts = 0;
  let installs = 0;
  let cleanups = 0;
  try {
    await expect(
      installDefaultExtensions({
        config: { defaultExtensions: ["retry-tool"] },
        env: { PSTDIO_HOME: join(root, "home") },
        extensionInstallations: jobs,
        signal: caller.signal,
        prepareSharedCheckout: async () => {
          const source = join(root, String(++checkouts));
          if (failure === "checkout" && checkouts === 1) throw new Error("Checkout failed");
          writeExtension(source, "retry-tool", "user");
          return {
            prepareNamedSource: async () => ({ path: source, ref: "release" }),
            cleanup: () => {
              cleanups++;
              rmSync(source, { recursive: true, force: true });
            },
          };
        },
        installExtensionSource: async () => {
          if (failure === "install" && ++installs === 1) throw new Error("Install failed");
          return installed;
        },
      }),
    ).rejects.toThrow(failure === "checkout" ? "Checkout failed" : "Install failed");
    caller.abort();
    const job = jobs.list()[0]!;
    jobs.retry(job.id);
    await jobs.wait(job.id);
    expect(jobs.list()[0]?.status).toBe("completed");
    expect(checkouts).toBe(2);
    expect(cleanups).toBe(failure === "checkout" ? 1 : 2);
  } finally {
    await jobs.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkout cleanup failures remain owned by the installation attempt", async () => {
  const root = mkdtempSync(join(tmpdir(), "default-extensions-cleanup-"));
  const source = join(root, "source");
  writeExtension(source, "cleanup-tool", "user");
  const jobs = createExtensionInstallations();
  try {
    await expect(
      installDefaultExtensions({
        config: { defaultExtensions: ["cleanup-tool"] },
        env: { PSTDIO_HOME: join(root, "home") },
        extensionInstallations: jobs,
        installExtensionSource: async () => installed,
        prepareSharedCheckout: async () => ({
          prepareNamedSource: async () => ({ path: source, ref: "release" }),
          cleanup: () => {
            throw new Error("Checkout cleanup failed");
          },
        }),
      }),
    ).rejects.toThrow("Checkout cleanup failed");
    expect(jobs.list()[0]?.status).toBe("failed");
  } finally {
    await jobs.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
