import { afterEach, describe, expect, mock, test } from "bun:test";
import { PstdioApiError } from "@pstdio/sdk/client";
import { createHandler } from "./add";

const source = {
  metadata: { id: "test.tool", name: "tool", displayName: "Tool", version: "1.0.0" },
  targetPath: "/host/extensions/tool",
  check: {
    extensionsRoot: "/host/extensions",
    extensions: [],
    commands: [],
    errorCount: 0,
    warningCount: 0,
    diagnostics: [],
    hostCompatibility: { status: "verified" },
  },
};
const makeDeps = () => ({
  cwd: () => "/client/project",
  findProjectRoot: () => "/client/project",
  readConfig: () => ({ project_id: "project" }),
  ensureApi: mock(async () => undefined),
  install: mock(async () => ({ source, extension: {} }) as never),
  upload: mock(async () => ({ upload: new FormData() })),
  log: mock((_message: string) => {}),
});
afterEach(() => {
  process.exitCode = 0;
});
describe("extensions add", () => {
  test("sends catalog options to the host and prints its installed path", async () => {
    const deps = makeDeps();
    await createHandler(deps)({
      source: "tool",
      name: "custom",
      force: true,
      branch: "main",
      "skip-install": true,
    } as never);
    expect(deps.install).toHaveBeenCalledWith("project", {
      source: { kind: "catalog", name: "tool", ref: "main" },
      installName: "custom",
      force: true,
      skipInstall: true,
    });
    expect(deps.log.mock.calls[0]?.[0]).toContain("/host/extensions/tool");
  });
  test("uploads local files instead of asking for the host project folder", async () => {
    const deps = makeDeps();
    await createHandler(deps)({ source: "./tool" } as never);
    expect(deps.upload).toHaveBeenCalledWith(
      "./tool",
      { installName: undefined, force: undefined, skipInstall: undefined },
      "project",
    );
    expect(deps.install).toHaveBeenCalledWith("project", { upload: expect.any(FormData) });
  });
  test("asks for a linked project before installing", async () => {
    const deps = { ...makeDeps(), findProjectRoot: () => null };
    await expect(createHandler(deps)({ source: "tool" } as never)).rejects.toThrow("linked project");
    expect(deps.install).not.toHaveBeenCalled();
  });
  test("prints the host conflict and exits with code one", async () => {
    const deps = makeDeps();
    deps.install.mockRejectedValueOnce(new PstdioApiError("An extension is already installed at /host/tool.", 409));
    await createHandler(deps)({ source: "tool" } as never);
    expect(process.exitCode).toBe(1);
    expect(deps.log).toHaveBeenCalledWith("An extension is already installed at /host/tool.");
  });
});
