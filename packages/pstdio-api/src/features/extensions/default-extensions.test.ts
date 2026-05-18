import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  enableInstalledExtensionsForProject,
  installDefaultExtensions,
  resolveDefaultExtensionsConfig,
} from "./default-extensions";

const installed = {
  installName: "pstdio-core-skills",
  targetPath: "/home/user/.pstdio/extensions/pstdio-core-skills",
  source: { kind: "named" as const, name: "pstdio-core-skills", ref: "repo#main:extensions/pstdio-core-skills" },
  metadata: {
    id: "pstdio.pstdio-core-skills",
    name: "pstdio-core-skills",
    displayName: "Core Skills",
    version: "0.1.0",
    enginesPstdio: "^1.0.0",
  },
  manifest: { id: "pstdio.pstdio-core-skills" },
  sourceHash: "hash",
  check: {
    extensionsRoot: "/home/user/.pstdio/extensions",
    extensionsRootExists: true,
    errorCount: 0,
    warningCount: 0,
    extensions: [],
    commands: [],
    middlewares: [],
    hooks: [],
    schedules: [],
    artifactMounts: [],
    themes: [],
    fileIconThemes: [],
    menuContributions: [],
    views: [],
    routes: [],
    navigation: [],
    settingsPanels: [],
    templates: [],
    skills: [],
    diagnostics: [],
  },
};

const writeExtension = (dir: string, namespace: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: namespace,
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), `export default {};`);
};

const writeInvalidExtension = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
  broken: true,
};`,
  );
};

describe("resolveDefaultExtensionsConfig", () => {
  test("returns the production defaults when the env override is absent", () => {
    expect(resolveDefaultExtensionsConfig({}).defaultExtensions).toEqual([
      "pstdio-core-skills",
      "pstdio-core-templates",
    ]);
  });

  test("uses PSTDIO_DEFAULT_EXTENSIONS JSON when set", () => {
    const config = resolveDefaultExtensionsConfig({
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
        { source: "./extensions/pstdio-core-skills", installName: "core-skills-dev", skipInstall: true },
      ]),
    });

    expect(config.defaultExtensions).toEqual([
      { source: "./extensions/pstdio-core-skills", installName: "core-skills-dev", skipInstall: true },
    ]);
  });
});

describe("installDefaultExtensions", () => {
  test("passes existsOk=true and reuses one shared checkout for all named entries", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return installed;
    });
    const prepareNamedSource = mock(async () => ({ path: "/tmp/x", ref: "ref" }));
    const cleanup = mock();
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource, cleanup }));

    await installDefaultExtensions({
      config: { defaultExtensions: ["pstdio-core-skills", "pstdio-core-templates"] },
      installExtensionSource,
      prepareSharedCheckout,
    });

    expect(prepareSharedCheckout).toHaveBeenCalledTimes(1);
    expect(prepareSharedCheckout).toHaveBeenCalledWith(["pstdio-core-skills", "pstdio-core-templates"]);
    expect(installExtensionSource).toHaveBeenCalledTimes(2);
    expect(calls[0]?.existsOk).toBe(true);
    expect(calls[0]?.prepareNamedSource).toBe(prepareNamedSource);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("skips the shared checkout when all entries are local paths", async () => {
    const installExtensionSource = mock(async () => installed);
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource: mock(), cleanup: mock() }));

    await installDefaultExtensions({
      config: { defaultExtensions: [{ source: "./extensions/pstdio-core-skills" }] },
      installExtensionSource,
      prepareSharedCheckout,
    });

    expect(prepareSharedCheckout).not.toHaveBeenCalled();
    expect(installExtensionSource).toHaveBeenCalledTimes(1);
  });
});

describe("enableInstalledExtensionsForProject", () => {
  test("enables every installed extension found on disk for the project", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-"));
    writeExtension(join(root, "core-templates"), "core-templates");
    writeExtension(join(root, "core-skills"), "core-skills");
    const calls: Array<Record<string, unknown>> = [];
    const enableInstalledSourceForProject = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return {};
    });

    try {
      const enabled = await enableInstalledExtensionsForProject({
        extensionService: { enableInstalledSourceForProject },
        extensionsRoot: root,
        projectId: "project-1",
      });

      expect(enabled).toEqual(["core-skills", "core-templates"]);
      expect(enableInstalledSourceForProject).toHaveBeenCalledTimes(2);
      expect(calls[0]?.installName).toBe("core-skills");
      expect(calls[0]?.name).toBe("core-skills");
      expect(calls[0]).not.toHaveProperty("defaultTemplates");
      expect(calls[0]?.sourceKind).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns empty when the extensions root does not exist", async () => {
    const enableInstalledSourceForProject = mock(async () => ({}));
    const enabled = await enableInstalledExtensionsForProject({
      extensionService: { enableInstalledSourceForProject },
      extensionsRoot: "/nonexistent-pstdio-root",
      projectId: "project-1",
    });

    expect(enabled).toEqual([]);
    expect(enableInstalledSourceForProject).not.toHaveBeenCalled();
  });

  test("skips invalid installed extensions while enabling the valid ones", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-invalid-"));
    writeExtension(join(root, "core-skills"), "core-skills");
    writeInvalidExtension(join(root, "extension-lab"));
    const enableInstalledSourceForProject = mock(async () => ({}));

    try {
      const enabled = await enableInstalledExtensionsForProject({
        extensionService: { enableInstalledSourceForProject },
        extensionsRoot: root,
        projectId: "project-1",
      });

      expect(enabled).toEqual(["core-skills"]);
      expect(enableInstalledSourceForProject).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
