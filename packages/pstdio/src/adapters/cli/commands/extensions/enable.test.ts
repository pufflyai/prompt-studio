import { describe, expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./enable";

type EnableArgvShape = {
  installName: string;
  projectId?: string;
};

const argv = (overrides: Partial<Arguments<EnableArgvShape>>) =>
  ({
    _: [],
    $0: "pstdio",
    installName: overrides.installName ?? "extension-lab",
    projectId: overrides.projectId,
  }) as Arguments<EnableArgvShape>;

describe("extensions enable", () => {
  test("enables an installed extension for the linked project", async () => {
    const setupProjectExtension = mock(async () => ({
      extensionId: "pstdio.extension-lab",
      namespace: "lab",
      installName: "extension-lab",
      installedSkills: [
        { id: "lab.lab", extensionId: "pstdio.extension-lab", skillKey: "lab", installedAgents: ["opencode"] },
      ],
    }));
    const log = mock((_: string) => undefined);
    const exit = mock((_: number) => undefined);

    const handler = createHandler({
      log,
      exit,
      cwd: () => "/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
      setupProjectExtension,
    });

    await handler(argv({ installName: "extension-lab" }));

    expect(setupProjectExtension).toHaveBeenCalledWith("proj-1", "extension-lab");
    expect(log.mock.calls.map((c) => c[0]).join("")).toContain("Enabled extension extension-lab for project.");
    expect(exit).not.toHaveBeenCalled();
  });

  test("uses an explicit project id", async () => {
    const setupProjectExtension = mock(async () => ({
      extensionId: "pstdio.extension-lab",
      namespace: "lab",
      installName: "extension-lab",
      installedSkills: [],
    }));
    const handler = createHandler({
      log: () => undefined,
      exit: () => undefined,
      cwd: () => "/outside",
      resolveProjectId: (_cwd, projectId) => ({ projectId: projectId!, root: null }),
      setupProjectExtension,
    });

    await handler(argv({ installName: "extension-lab", projectId: "proj-explicit" }));

    expect(setupProjectExtension).toHaveBeenCalledWith("proj-explicit", "extension-lab");
  });
});
