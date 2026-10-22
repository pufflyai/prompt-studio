import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { installDefaultExtensions, resolveDefaultExtensionsConfig } from "./default-extensions";
import { installed, writeExtension } from "./default-extensions-test-fixtures";

afterEach(() => {
  rmSync(join(tmpdir(), "pstdio-default-extensions"), { recursive: true, force: true });
});

describe("resolveDefaultExtensionsConfig", () => {
  test("returns the production defaults when the env override is absent", async () => {
    const config = await resolveDefaultExtensionsConfig({});

    expect(config.defaultExtensions).toEqual([
      "harness-claude-code",
      "harness-codex",
      "harness-open-code",
      "pstdio-base-themes",
      "pstdio-skills",
    ]);
  });

  test("uses PSTDIO_DEFAULT_EXTENSIONS JSON when set", async () => {
    const config = await resolveDefaultExtensionsConfig({
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
        { source: "./extensions/pstdio-planner", installName: "planner-dev", skipInstall: true },
      ]),
    });

    expect(config.defaultExtensions).toEqual([
      { source: "./extensions/pstdio-planner", installName: "planner-dev", skipInstall: true },
    ]);
  });

  test("derives defaults from an operator catalog", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-catalog-"));
    const catalogPath = join(root, "catalog.json");
    writeFileSync(
      catalogPath,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "recipes",
            displayName: "Recipes",
            description: "Recipe tools.",
            origin: {
              kind: "git",
              url: "https://example.com/extensions.git",
              path: "extensions/recipes",
              ref: "v1.0.0",
            },
            default: true,
          },
        ],
      }),
    );

    try {
      expect(
        await resolveDefaultExtensionsConfig({
          PSTDIO_EXTENSION_CATALOG: catalogPath,
          PSTDIO_HOME: join(root, "home"),
        }),
      ).toEqual({ defaultExtensions: ["recipes"] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installDefaultExtensions", () => {
  test("prepares independent defaults while another dependency install is pending", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-overlap-"));
    const first = join(root, "first");
    const second = join(root, "second");
    const third = join(root, "third");
    writeExtension(first, "first");
    writeExtension(second, "second");
    writeExtension(third, "third");
    const releaseFirst = Promise.withResolvers<void>();
    const firstStarted = Promise.withResolvers<void>();
    const started: string[] = [];
    const pending = installDefaultExtensions({
      config: { defaultExtensions: [{ source: first }, { source: second }, { source: third }] },
      env: { PSTDIO_HOME: join(root, "home") },
      installExtensionSource: async (input) => {
        const name = basename(input.source);
        started.push(name);
        if (name !== "third") {
          if (name === "first") firstStarted.resolve();
          await releaseFirst.promise;
        }
        return { ...installed, installName: name };
      },
    });
    try {
      await firstStarted.promise;
      expect(started).toEqual(["first", "second"]);
      releaseFirst.resolve();
      expect((await pending).map((entry) => entry.installName)).toEqual(["first", "second", "third"]);
    } finally {
      releaseFirst.resolve();
      await pending;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps defaults for the same install target in configuration order", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-target-order-"));
    const first = join(root, "first");
    const second = join(root, "second");
    writeExtension(first, "first");
    writeExtension(second, "second");
    const releaseFirst = Promise.withResolvers<void>();
    const firstStarted = Promise.withResolvers<void>();
    const started: string[] = [];
    const pending = installDefaultExtensions({
      config: {
        defaultExtensions: [
          { source: first, installName: "shared" },
          { source: second, installName: "shared" },
        ],
      },
      env: { PSTDIO_HOME: join(root, "home") },
      installExtensionSource: async (input) => {
        const name = input.source === first ? "first" : "second";
        started.push(name);
        if (name === "first") {
          firstStarted.resolve();
          await releaseFirst.promise;
        }
        return { ...installed, sourceHash: name };
      },
    });
    try {
      await firstStarted.promise;
      expect(started).toEqual(["first"]);
      releaseFirst.resolve();
      expect((await pending).map((entry) => entry.sourceHash)).toEqual(["first", "second"]);
    } finally {
      releaseFirst.resolve();
      await pending;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps the shared checkout until pending installs finish after a failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-pending-cleanup-"));
    for (const name of ["broken", "pending"]) writeExtension(join(root, name), name);
    const releasePending = Promise.withResolvers<void>();
    const pendingStarted = Promise.withResolvers<void>();
    const cleanup = mock();
    const failure = new Error("Dependency installation failed");
    const result = installDefaultExtensions({
      config: { defaultExtensions: ["broken", "pending"] },
      env: { PSTDIO_HOME: join(root, "home") },
      prepareSharedCheckout: async () => ({
        prepareNamedSource: async (name) => ({ path: join(root, name), ref: "test-ref" }),
        cleanup,
      }),
      installExtensionSource: async (input) => {
        if (input.source === "broken") throw failure;
        pendingStarted.resolve();
        await releasePending.promise;
        return installed;
      },
    }).catch((error: unknown) => error);
    try {
      await pendingStarted.promise;
      await Bun.sleep(0);
      expect(cleanup).not.toHaveBeenCalled();
      releasePending.resolve();
      expect(await result).toBe(failure);
      expect(cleanup).toHaveBeenCalledTimes(1);
    } finally {
      releasePending.resolve();
      await result;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("serializes concurrent default extension setup", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-serialized-"));
    const source = join(root, "pstdio-planner");
    writeExtension(source, "pstdio-planner");
    const firstInstallReleased = Promise.withResolvers<void>();
    const firstInstallStarted = Promise.withResolvers<void>();
    let calls = 0;
    const install = mock(async () => {
      calls++;
      if (calls === 1) {
        firstInstallStarted.resolve();
        await firstInstallReleased.promise;
      }
      return installed;
    });
    const input = {
      config: { defaultExtensions: [{ source }] },
      installExtensionSource: install,
    };

    try {
      const first = installDefaultExtensions(input);
      await firstInstallStarted.promise;
      const second = installDefaultExtensions(input);
      await Bun.sleep(0);

      expect(install).toHaveBeenCalledTimes(1);

      firstInstallReleased.resolve();
      await Promise.all([first, second]);
      expect(install).toHaveBeenCalledTimes(2);
    } finally {
      firstInstallReleased.resolve();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installDefaultExtensions cancellation", () => {
  test("settles cancellation while an active installer is stopping", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-cancel-"));
    const source = join(root, "pstdio-planner");
    writeExtension(source, "pstdio-planner");
    const installStarted = Promise.withResolvers<void>();
    const installReleased = Promise.withResolvers<void>();
    const controller = new AbortController();
    const result = installDefaultExtensions({
      config: { defaultExtensions: [{ source }] },
      installExtensionSource: async () => {
        installStarted.resolve();
        await installReleased.promise;
        return installed;
      },
      signal: controller.signal,
    });

    try {
      await installStarted.promise;
      controller.abort();
      const cancelled = await Promise.race([
        result.then(
          () => false,
          () => true,
        ),
        Bun.sleep(100).then(() => false),
      ]);

      expect(cancelled).toBe(true);
    } finally {
      installReleased.resolve();
      await installDefaultExtensions({ config: { defaultExtensions: [] } });
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installDefaultExtensions sources", () => {
  test("uses local source packages for production defaults when running from source", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return installed;
    });
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource: mock(), cleanup: mock() }));

    await installDefaultExtensions({
      env: {},
      installExtensionSource,
      prepareSharedCheckout,
    });

    expect(prepareSharedCheckout).not.toHaveBeenCalled();
    expect(calls.map((call) => call.installName)).toEqual([
      "harness-claude-code",
      "harness-codex",
      "harness-open-code",
      "pstdio-base-themes",
      "pstdio-skills",
    ]);
    expect(
      calls.every(
        (call) =>
          typeof call.source === "string" && (call.source as string).replaceAll("\\", "/").includes("/extensions/"),
      ),
    ).toBe(true);
    expect(calls.every((call) => call.skipInstall === true)).toBe(true);
    expect(calls.every((call) => call.force === true)).toBe(true);
  });

  test("fetches named defaults from Git at the host release when local sources are unavailable", async () => {
    const extensionName = "marketplace-planner";
    const source = join(tmpdir(), "pstdio-default-extensions", extensionName);
    writeExtension(source, extensionName);

    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return { ...installed, installName: extensionName };
    });
    const prepareNamedSource = mock(async () => ({
      path: source,
      ref: "https://github.com/pufflyai/prompt-studio@commit#extensions/marketplace-planner",
    }));
    const cleanup = mock();
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource, cleanup }));

    await installDefaultExtensions({
      config: { defaultExtensions: [extensionName] },
      installExtensionSource,
      prepareSharedCheckout,
      releaseRef: "pstdio@0.27.0",
    });

    expect(prepareSharedCheckout).toHaveBeenCalledWith([extensionName], { hostReleaseRef: "pstdio@0.27.0" });
    expect(installExtensionSource).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      allowUnsupportedApiVersion: true,
      existsOk: true,
      prepareNamedSource: expect.any(Function),
      hostReleaseRef: "pstdio@0.27.0",
      source: extensionName,
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("allows an explicit default ref for isolated upgrade testing", async () => {
    const extensionName = "marketplace-harness";
    const source = join(tmpdir(), "pstdio-default-extensions", extensionName);
    writeExtension(source, extensionName);
    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return { ...installed, installName: extensionName };
    });
    const prepareNamedSource = mock(async () => ({ path: source, ref: "old-commit" }));
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource, cleanup: mock() }));

    await installDefaultExtensions({
      config: { defaultExtensions: [{ source: extensionName, ref: "pstdio@0.26.2" }] },
      installExtensionSource,
      prepareSharedCheckout,
      releaseRef: "pstdio@0.27.0",
    });

    expect(prepareSharedCheckout).toHaveBeenCalledWith([extensionName], {
      hostReleaseRef: "pstdio@0.27.0",
      ref: "pstdio@0.26.2",
    });
    expect(calls[0]).toMatchObject({
      allowUnsupportedApiVersion: true,
      existsOk: true,
      ref: "pstdio@0.26.2",
      source: extensionName,
    });
  });

  test("passes existsOk=true and reuses one shared checkout for all named entries", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-shared-"));
    writeExtension(join(root, "pstdio-planner"), "pstdio-planner");
    writeExtension(join(root, "pstdio-skills"), "pstdio-skills");
    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return installed;
    });
    const prepareNamedSource = mock(async (name: string) => ({ path: join(root, name), ref: "ref" }));
    const cleanup = mock();
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource, cleanup }));
    const controller = new AbortController();

    try {
      await installDefaultExtensions({
        config: { defaultExtensions: ["pstdio-planner", "pstdio-skills"] },
        installExtensionSource,
        prepareSharedCheckout,
        signal: controller.signal,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(prepareSharedCheckout).toHaveBeenCalledTimes(1);
    expect(prepareSharedCheckout).toHaveBeenCalledWith(["pstdio-planner", "pstdio-skills"], {
      signal: controller.signal,
    });
    expect(installExtensionSource).toHaveBeenCalledTimes(2);
    expect(calls[0]?.existsOk).toBe(true);
    expect(calls[0]?.prepareNamedSource).toEqual(expect.any(Function));
    expect(calls.every((call) => call.signal === controller.signal)).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("skips the shared checkout when all entries are local paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-local-"));
    const source = join(root, "pstdio-planner");
    writeExtension(source, "pstdio-planner");
    const installExtensionSource = mock(async () => installed);
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource: mock(), cleanup: mock() }));

    try {
      await installDefaultExtensions({
        config: { defaultExtensions: [{ source }] },
        installExtensionSource,
        prepareSharedCheckout,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(prepareSharedCheckout).not.toHaveBeenCalled();
    expect(installExtensionSource).toHaveBeenCalledTimes(1);
  });

  test("continues after a default extension install fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-best-effort-"));
    const broken = join(root, "broken-extension");
    const healthy = join(root, "healthy-extension");
    writeExtension(broken, "broken-extension");
    writeExtension(healthy, "healthy-extension");
    const failures: Array<{ installName: string; message: string; source: string }> = [];
    const installExtensionSource = mock(async (input: { installName?: string; source: string }) => {
      if (input.installName === "broken") throw new Error("Cannot find module '@pstdio/sdk/extensions'");
      return { ...installed, installName: input.installName ?? "healthy" };
    });

    try {
      const result = await installDefaultExtensions({
        config: {
          defaultExtensions: [
            { source: broken, installName: "broken", skipInstall: true },
            { source: healthy, installName: "healthy", skipInstall: true },
          ],
        },
        installExtensionSource,
        onInstallFailure: ({ error, installName, source }) => {
          failures.push({ installName, message: error instanceof Error ? error.message : String(error), source });
        },
      });

      expect(result.map((entry) => entry.installName)).toEqual(["healthy"]);
      expect(failures).toEqual([
        {
          installName: "broken",
          message: "Cannot find module '@pstdio/sdk/extensions'",
          source: broken,
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
