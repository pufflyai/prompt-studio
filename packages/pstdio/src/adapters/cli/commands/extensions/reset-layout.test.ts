import { expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type ExtensionsResetLayoutArgs } from "./reset-layout";

const extension = {
  id: "instance-1",
  projectId: "project-1",
  extensionId: "pstdio.extension-lab",
  installedExtensionId: "installed-1",
  installName: "extension-lab",
  name: "extension-lab",
  displayName: "Extension Lab",
  sourcePath: "/extensions/extension-lab",
  scope: "global" as const,
  status: "loaded" as const,
  enabled: true,
  config: {},
};

test("requests an extension layout reset for the linked project and optional mode", async () => {
  const log = mock();
  const resetLayout = mock(async () => ({
    extensionId: extension.extensionId,
    instanceId: extension.id,
    modeId: "extension-lab.detail",
    projectId: "project-1",
    revision: "revision-1",
  }));
  const handler = createHandler({
    cwd: () => "/repo",
    findGitRoot: () => "/repo",
    listProjectExtensions: mock(async () => ({ extensions: [extension] })),
    log,
    readConfig: () => ({ project_id: "project-1" }),
    resetLayout,
  });

  await handler({
    _: [],
    $0: "pstdio",
    extension: "extension-lab",
    mode: "extension-lab.detail",
  } as Arguments<ExtensionsResetLayoutArgs>);

  expect(resetLayout).toHaveBeenCalledWith("project-1", "instance-1", { modeId: "extension-lab.detail" });
  expect(log).toHaveBeenCalledWith(expect.stringContaining("Extension: extension-lab"));
  expect(log).toHaveBeenCalledWith(expect.stringContaining("Mode: extension-lab.detail"));
});

test("requires an explicit project when the current repository is not linked", async () => {
  const handler = createHandler({
    cwd: () => "/outside",
    findGitRoot: () => null,
    listProjectExtensions: mock(async () => ({ extensions: [] })),
    log: mock(),
    readConfig: () => null,
    resetLayout: mock(async () => {
      throw new Error("not called");
    }),
  });

  await expect(
    handler({ _: [], $0: "pstdio", extension: "extension-lab" } as Arguments<ExtensionsResetLayoutArgs>),
  ).rejects.toThrow("Run inside a linked project or pass --project-id");
});
