import { afterEach, describe, expect, type Mock, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkExtensions,
  ExtensionInstallError,
  type InstallExtensionDeps,
  type InstallExtensionInput,
  type InstallExtensionResult,
  installExtensionSource,
} from "pstdio-extensions";
import type { Arguments } from "yargs";
import { createHandler } from "./add";

const tempDirs: string[] = [];

const createTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const VALID_EXTENSION_SRC = `export default {
  id: "acme.my-extension",
  namespace: "my-extension",
  name: "My Extension",
  version: "0.1.0",
  commands: {
    "say-hi": { title: "Say hi", cli: true, run: async () => undefined },
  },
};`;

const writeFolderExtension = (root: string, name: string, source: string) => {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "extension.ts"), source);
  return dir;
};

type DepsHarness = {
  log: Mock<(msg: string) => void>;
  err: Mock<(msg: string) => void>;
  exit: Mock<(code: number) => void>;
  installCalls: Array<{ input: InstallExtensionInput; deps?: InstallExtensionDeps }>;
};

const makeRealInstallDeps = (extensionsRoot: string) => {
  const harness: DepsHarness = {
    log: mock() as Mock<(msg: string) => void>,
    err: mock() as Mock<(msg: string) => void>,
    exit: mock() as Mock<(code: number) => void>,
    installCalls: [],
  };

  const install = async (input: InstallExtensionInput, deps?: InstallExtensionDeps) => {
    harness.installCalls.push({ input, deps });
    return installExtensionSource({ ...input, extensionsRoot }, deps);
  };

  return {
    deps: { install, log: harness.log, err: harness.err, exit: harness.exit },
    harness,
  };
};

type AddArgvShape = {
  source: string;
  name?: string;
  force?: boolean;
  ref?: string;
  install?: "npm" | "bun";
  skipInstall?: boolean;
  projectId?: string;
};

const argv = (overrides: Partial<Arguments<AddArgvShape>>) =>
  ({
    _: [],
    $0: "pstdio",
    source: overrides.source ?? "",
    name: overrides.name,
    force: overrides.force ?? false,
    ref: overrides.ref,
    install: overrides.install,
    skipInstall: overrides.skipInstall,
    projectId: overrides.projectId,
  }) as Arguments<AddArgvShape>;

describe("extensions add (local folder)", () => {
  test("installs a local folder and reports diagnostics", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "my-extension-folder", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir }));

    const printed = harness.log.mock.calls.map((c) => c[0]).join("");
    expect(printed).toContain("Installed extension");
    expect(printed).toContain("ID:         acme.my-extension");
    expect(printed).toContain("Namespace:  my-extension");
    expect(printed).toContain("Version:    0.1.0");
    expect(printed).toContain("Errors:   0");
    expect(harness.exit).not.toHaveBeenCalled();
  });

  test("--name overrides the install folder name", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "my-extension-folder", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir, name: "my-custom-extension" }));

    const printed = harness.log.mock.calls.map((c) => c[0]).join("");
    expect(printed).toContain(join(extensionsRoot, "my-custom-extension"));
    expect(harness.exit).not.toHaveBeenCalled();
  });

  test("enables the installed extension for the current project when linked", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "my-extension-folder", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const setupProjectExtension = mock(async () => ({
      extensionId: "acme.my-extension",
      namespace: "my-extension",
      installName: "my-extension-folder",
      installedSkills: [],
    }));
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler({
      ...deps,
      cwd: () => "/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
      setupProjectExtension,
    });

    await handler(argv({ source: sourceDir }));

    expect(setupProjectExtension).toHaveBeenCalledWith("proj-1", "my-extension-folder");
    const printed = harness.log.mock.calls.map((c) => c[0]).join("");
    expect(printed).toContain("Enabled for project.");
    expect(harness.exit).not.toHaveBeenCalled();
  });

  test("fails clearly when the source folder does not exist", async () => {
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: "./does-not-exist-fail-please" }));

    const errOut = harness.err.mock.calls.map((c) => c[0]).join("");
    expect(errOut).toContain("Failed to install extension");
    expect(errOut).toContain("does-not-exist-fail-please");
    expect(harness.exit).toHaveBeenCalledWith(1);
  });

  test("fails clearly when extension.ts is missing", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = join(sourceParent, "missing-entry");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "README.md"), "# nope");
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir }));

    const errOut = harness.err.mock.calls.map((c) => c[0]).join("");
    expect(errOut).toContain("No extension.ts found");
    expect(harness.exit).toHaveBeenCalledWith(1);
  });

  test("fails clearly when the extension default export is invalid", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "broken", `export default "nope";`);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir }));

    const errOut = harness.err.mock.calls.map((c) => c[0]).join("");
    expect(errOut).toContain("Failed to install extension");
    expect(harness.exit).toHaveBeenCalledWith(1);
  });

  test("fails when an install already exists and --force is not set", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir }));
    expect(harness.exit).not.toHaveBeenCalled();

    await handler(argv({ source: sourceDir }));
    const errOut = harness.err.mock.calls.map((c) => c[0]).join("");
    expect(errOut).toContain("already installed");
    expect(harness.exit).toHaveBeenCalledWith(1);
  });

  test("--force replaces an existing install", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir }));
    await handler(argv({ source: sourceDir, force: true }));

    expect(harness.exit).not.toHaveBeenCalled();
    expect(harness.installCalls).toHaveLength(2);
    expect(harness.installCalls[1]?.input.force).toBe(true);
  });
});

describe("extensions add (named github source)", () => {
  test("forwards a github resolution through the install pipeline", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");

    const log = mock() as Mock<(msg: string) => void>;
    const err = mock() as Mock<(msg: string) => void>;
    const exit = mock() as Mock<(code: number) => void>;

    const fetchGithubExtension = mock(async () => ({
      kind: "github" as const,
      rootPath: sourceDir,
      defaultInstallName: "planner",
    }));

    const install = (input: InstallExtensionInput) =>
      installExtensionSource({ ...input, extensionsRoot }, { fetchGithubExtension });

    const handler = createHandler({ install, log, err, exit });

    await handler(argv({ source: "planner" }));

    expect(fetchGithubExtension).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    const printed = log.mock.calls.map((c) => c[0]).join("");
    expect(printed).toContain("ID:         acme.my-extension");
    expect(printed).toContain(join(extensionsRoot, "planner"));
  });
});

describe("extensions add integration with extensions check", () => {
  test("a successfully installed extension appears in extensions check", async () => {
    const sourceParent = createTempDir("pstdio-add-cli-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const home = createTempDir("pstdio-add-cli-home-");
    const extensionsRoot = join(home, "extensions");
    const { deps, harness } = makeRealInstallDeps(extensionsRoot);
    const handler = createHandler(deps);

    await handler(argv({ source: sourceDir }));
    expect(harness.exit).not.toHaveBeenCalled();

    const check = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(check.runtime.extensions.map((e) => e.id)).toContain("acme.my-extension");
    expect(check.errorCount).toBe(0);
  });
});

describe("extensions add (dependency installer flags)", () => {
  test("--skip-install is forwarded to the installer", async () => {
    const log = mock() as Mock<(msg: string) => void>;
    const err = mock() as Mock<(msg: string) => void>;
    const exit = mock() as Mock<(code: number) => void>;
    const captured: InstallExtensionInput[] = [];
    const install = mock(async (input: InstallExtensionInput) => {
      captured.push(input);
      return {
        installPath: "/tmp/x",
        installName: "x",
        sourceKind: "local",
        extension: null,
        runtime: {
          extensions: [],
          commands: [],
          middlewares: [],
          hooks: [],
          schedules: [],
          artifactMounts: [],
          views: [],
          routes: [],
          navigation: [],
          templates: [],
          skills: [],
          diagnostics: [],
        },
        errorCount: 0,
        warningCount: 0,
        dependencyInstall: { ran: false, reason: "skipped" },
      } as unknown as InstallExtensionResult;
    });

    const handler = createHandler({ install, log, err, exit });
    await handler(argv({ source: "/tmp/foo", skipInstall: true }));

    expect(captured[0]?.skipInstall).toBe(true);
    const printed = log.mock.calls.map((c) => c[0]).join("");
    expect(printed).toContain("Skipped dependency installation.");
  });

  test("--install=<manager> is forwarded to the installer", async () => {
    const log = mock() as Mock<(msg: string) => void>;
    const err = mock() as Mock<(msg: string) => void>;
    const exit = mock() as Mock<(code: number) => void>;
    const captured: InstallExtensionInput[] = [];
    const install = mock(async (input: InstallExtensionInput) => {
      captured.push(input);
      return {
        installPath: "/tmp/x",
        installName: "x",
        sourceKind: "local",
        extension: null,
        runtime: {
          extensions: [],
          commands: [],
          middlewares: [],
          hooks: [],
          schedules: [],
          artifactMounts: [],
          views: [],
          routes: [],
          navigation: [],
          templates: [],
          skills: [],
          diagnostics: [],
        },
        errorCount: 0,
        warningCount: 0,
        dependencyInstall: { ran: true, manager: "bun", command: "bun install" },
      } as unknown as InstallExtensionResult;
    });

    const handler = createHandler({ install, log, err, exit });
    await handler(argv({ source: "/tmp/foo", install: "bun" }));

    expect(captured[0]?.packageManager).toBe("bun");
    const printed = log.mock.calls.map((c) => c[0]).join("");
    expect(printed).toContain("Dependencies installed with bun: bun install");
  });

  test("dependency_install_failed surfaces through the failure formatter", async () => {
    const log = mock() as Mock<(msg: string) => void>;
    const err = mock() as Mock<(msg: string) => void>;
    const exit = mock() as Mock<(code: number) => void>;
    const install = mock(async () => {
      throw new ExtensionInstallError(
        "dependencies_install_failed",
        "Failed to install dependencies:\n  npm install\n\nReason:\n  exited 1",
      );
    });

    const handler = createHandler({ install, log, err, exit });
    await handler(argv({ source: "/tmp/foo" }));

    const errOut = err.mock.calls.map((c) => c[0]).join("");
    expect(errOut).toContain("Failed to install dependencies");
    expect(errOut).toContain("npm install");
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("ExtensionInstallError integration", () => {
  test("typed install errors round-trip through the failure formatter", async () => {
    const log = mock() as Mock<(msg: string) => void>;
    const err = mock() as Mock<(msg: string) => void>;
    const exit = mock() as Mock<(code: number) => void>;
    const install = mock(async () => {
      throw new ExtensionInstallError("source_not_found", "Source folder does not exist: /nope");
    });

    const handler = createHandler({ install, log, err, exit });
    await handler(argv({ source: "/nope" }));

    const errOut = err.mock.calls.map((c) => c[0]).join("");
    expect(errOut).toContain("Failed to install extension");
    expect(errOut).toContain("Source folder does not exist: /nope");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
