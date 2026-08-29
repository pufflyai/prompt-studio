import { afterEach, describe, expect, mock, test } from "bun:test";
import type { ProjectExtensionInstance, UpgradeProjectExtensionResponse } from "@pstdio/sdk/api";
import type { Arguments } from "yargs";
import { createHandler, type ExtensionsUpdateArgs } from "./update";

const argv = (args: Partial<ExtensionsUpdateArgs> = {}) =>
  ({ _: [], $0: "pstdio", ...args }) as Arguments<ExtensionsUpdateArgs>;

const extension = (
  installName: string,
  overrides: Partial<ProjectExtensionInstance> = {},
): ProjectExtensionInstance => ({
  id: `${installName}-instance`,
  projectId: "project-1",
  extensionId: `pstdio.${installName}`,
  installedExtensionId: `${installName}-source`,
  installName,
  name: installName,
  displayName: installName,
  version: "1.0.0",
  sourcePath: `/repo/.pstdio/extensions/${installName}`,
  scope: "repo",
  status: "loaded",
  enabled: true,
  config: {},
  canUpgrade: true,
  updateAvailable: false,
  ...overrides,
});

const makeDeps = (extensions: ProjectExtensionInstance[]) => {
  const logs: string[] = [];
  const upgradeProjectExtension = mock(
    async (_projectId: string, instanceId: string): Promise<UpgradeProjectExtensionResponse> => ({
      changed: true,
      extension: extensions.find((candidate) => candidate.id === instanceId)!,
    }),
  );
  return {
    deps: {
      cwd: () => "/repo",
      listProjectExtensions: mock(async () => ({ extensions, marketplace: [] })),
      log: (message: string) => logs.push(message),
      resolveProjectId: () => ({ projectId: "project-1", root: "/repo", workspaceId: undefined }),
      upgradeProjectExtension,
    },
    logs,
    upgradeProjectExtension,
  };
};

describe("extensions update", () => {
  test("asks the host to upgrade a named extension instance", async () => {
    const planner = extension("pstdio-planner");
    const { deps, logs, upgradeProjectExtension } = makeDeps([planner]);

    await createHandler(deps)(argv({ name: "pstdio-planner" }));

    expect(deps.listProjectExtensions).toHaveBeenCalledWith("project-1");
    expect(upgradeProjectExtension).toHaveBeenCalledWith("project-1", planner.id);
    expect(logs).toEqual(["Updated pstdio-planner to 1.0.0."]);
  });

  test("uses the host candidate list for repo-scoped and disabled extensions", async () => {
    const repoExtension = extension("repo-tools", {
      enabled: false,
      status: "disabled",
      sourcePath: "/another-repo/.pstdio/extensions/repo-tools",
    });
    const localExtension = extension("local-tools", {
      canUpgrade: false,
      scope: "global",
      sourcePath: "/home/user/.pstdio/extensions/local-tools",
    });
    const { deps, upgradeProjectExtension } = makeDeps([repoExtension, localExtension]);

    await createHandler(deps)(argv());

    expect(upgradeProjectExtension).toHaveBeenCalledTimes(1);
    expect(upgradeProjectExtension).toHaveBeenCalledWith("project-1", repoExtension.id);
  });

  test("updates every matching repo copy for a named install", async () => {
    const first = extension("repo-tools", { id: "repo-tools-a" });
    const second = extension("repo-tools", { id: "repo-tools-b" });
    const { deps, upgradeProjectExtension } = makeDeps([first, second]);

    await createHandler(deps)(argv({ name: "repo-tools" }));

    expect(upgradeProjectExtension).toHaveBeenCalledTimes(2);
    expect(upgradeProjectExtension).toHaveBeenNthCalledWith(1, "project-1", first.id);
    expect(upgradeProjectExtension).toHaveBeenNthCalledWith(2, "project-1", second.id);
  });

  test("does not replace a source when the host offers no upgrade", async () => {
    const localExtension = extension("pstdio-planner", { canUpgrade: false });
    const { deps, logs, upgradeProjectExtension } = makeDeps([localExtension]);

    await createHandler(deps)(argv({ name: "pstdio-planner" }));

    expect(upgradeProjectExtension).not.toHaveBeenCalled();
    expect(logs).toEqual(['No host-managed update is available for "pstdio-planner".']);
  });

  test("fails clearly when the named extension is not attached to the project", async () => {
    const { deps, upgradeProjectExtension } = makeDeps([]);

    await expect(createHandler(deps)(argv({ name: "missing" }))).rejects.toThrow(
      'Extension "missing" is not installed in project project-1.',
    );

    expect(upgradeProjectExtension).not.toHaveBeenCalled();
  });

  test("continues after one host upgrade fails", async () => {
    const first = extension("first");
    const second = extension("second");
    const { deps, logs, upgradeProjectExtension } = makeDeps([first, second]);
    upgradeProjectExtension.mockImplementation(async (_projectId, instanceId) => {
      if (instanceId === first.id) throw new Error("download failed");
      return { changed: true, extension: second };
    });

    await createHandler(deps)(argv());

    expect(upgradeProjectExtension).toHaveBeenCalledTimes(2);
    expect(logs).toContain("ERROR: first: download failed");
    expect(logs).toContain("Updated second to 1.0.0.");
    expect(process.exitCode).toBe(1);
  });

  test("does not call the host when no project can be resolved", async () => {
    const { deps } = makeDeps([]);
    deps.resolveProjectId = () => {
      throw new Error("No project specified");
    };

    await expect(createHandler(deps)(argv())).rejects.toThrow("No project specified");

    expect(deps.listProjectExtensions).not.toHaveBeenCalled();
  });

  afterEach(() => {
    process.exitCode = 0;
  });
});
