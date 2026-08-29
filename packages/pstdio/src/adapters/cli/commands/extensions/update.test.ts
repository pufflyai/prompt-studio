import { describe, expect, mock, test } from "bun:test";
import { CLI_VERSION } from "@/features/cli-version";
import { createHandler } from "./update";

const catalogEntry = (installName: string, path: string) => ({
  installName,
  displayName: installName,
  description: installName,
  default: false,
  origin: {
    kind: "git" as const,
    url: "https://github.com/pstdio/pstdio.git",
    path,
    ref: "{hostRelease}",
  },
});

const catalog = {
  version: 1 as const,
  extensions: [catalogEntry("harness-claude-code", "extensions/x"), catalogEntry("pstdio-planner", "extensions/y")],
};

const installedSource = (installName: string) => ({
  installName,
  metadata: { id: `pstdio.${installName}`, name: installName, displayName: installName, version: "1.2.3" },
  manifest: { name: installName },
  targetPath: `/home/user/.pstdio/extensions/${installName}`,
  source: { kind: "named" as const, ref: null },
  sourceHash: "hash",
  check: { errorCount: 0 },
});

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const logs: string[] = [];
  const installs: unknown[] = [];
  const enabled: string[] = [];
  const deps = {
    cwd: () => "/repo",
    enableInstalledExtension: mock(async (projectId: string, installed: { installName: string }) => {
      enabled.push(`${projectId}:${installed.installName}`);
    }),
    ensureApi: mock(async () => {}),
    findGitRoot: () => "/repo" as string | null,
    getExtensionCatalog: async () => catalog,
    installExtensionSource: mock(async (input: { installName?: string }) => {
      installs.push(input);
      return installedSource(input.installName ?? "unknown") as never;
    }),
    listInstalledExtensions: () => ["harness-claude-code", "my-local-extension"],
    log: (message: string) => logs.push(message),
    readConfig: () => ({ project_id: "project-1" }) as never,
    resolvePstdioHome: () => "/home/user/.pstdio",
    ...overrides,
  };
  return { deps, logs, installs, enabled };
};

describe("extensions update", () => {
  test("reinstalls a named catalog extension at the release matching this CLI", async () => {
    const { deps, installs, enabled } = makeDeps();

    await createHandler(deps)({ name: "harness-claude-code" } as never);

    expect(installs).toEqual([
      {
        source: "harness-claude-code",
        installName: "harness-claude-code",
        force: true,
        hostReleaseRef: `pstdio@${CLI_VERSION}`,
        reuseInstalledDependencies: true,
        repoPath: "/repo",
      },
    ]);
    expect(enabled).toEqual(["project-1:harness-claude-code"]);
  });

  test("updates every managed extension in the user root when no name is given", async () => {
    const { deps, installs, logs } = makeDeps();

    await createHandler(deps)({} as never);

    expect(installs).toHaveLength(1);
    expect((installs[0] as { installName: string }).installName).toBe("harness-claude-code");
    expect(logs.join("\n")).toContain("my-local-extension");
  });

  test("fails a named update when the extension is not in the catalog", async () => {
    const { deps } = makeDeps();

    await expect(createHandler(deps)({ name: "my-local-extension" } as never)).rejects.toThrow("pst extensions add");
  });

  test("fails a named update when the catalog extension is not installed", async () => {
    const { deps, installs, enabled } = makeDeps();

    await expect(createHandler(deps)({ name: "pstdio-planner" } as never)).rejects.toThrow("not installed");

    expect(installs).toEqual([]);
    expect(enabled).toEqual([]);
  });

  test("updates without enabling when no project is linked", async () => {
    const { deps, enabled, logs } = makeDeps({ findGitRoot: () => null });

    await createHandler(deps)({ name: "harness-claude-code" } as never);

    expect(enabled).toEqual([]);
    expect(logs.join("\n")).toContain("harness-claude-code");
  });

  test("continues after one extension fails and reports the failure", async () => {
    const { deps, logs } = makeDeps({
      listInstalledExtensions: () => ["harness-claude-code", "pstdio-planner"],
      installExtensionSource: mock(async (input: { installName?: string }) => {
        if (input.installName === "harness-claude-code") throw new Error("clone failed");
        return installedSource(input.installName ?? "unknown") as never;
      }),
    });

    await createHandler(deps)({} as never);

    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    expect(logs.join("\n")).toContain("clone failed");
    expect(logs.join("\n")).toContain("pstdio-planner");
  });

  test("continues enabling repaired extensions after one enablement fails", async () => {
    const attempts: string[] = [];
    const { deps, logs } = makeDeps({
      listInstalledExtensions: () => ["harness-claude-code", "pstdio-planner"],
      enableInstalledExtension: mock(async (_projectId: string, installed: { installName: string }) => {
        attempts.push(installed.installName);
        if (installed.installName === "harness-claude-code") throw new Error("enable failed");
      }),
    });

    await createHandler(deps)({} as never);

    expect(attempts).toEqual(["harness-claude-code", "pstdio-planner"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    expect(logs.join("\n")).toContain("enable failed");
    expect(logs.join("\n")).toContain("Updated pstdio-planner");
  });
});
