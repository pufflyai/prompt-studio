import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./register";
import type { PluginsArgs } from "./shared";

const argv = (args: Partial<PluginsArgs>) => ({ _: [], $0: "", ...args }) as Arguments<PluginsArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/repo",
    findGitRoot: () => "/fake/repo",
    readConfig: () => ({ project_id: "proj-1" }),
    registerPlugins: async () => ({
      plugins: [{ identity: "ticket-actions", filePath: "/fake/repo/.pstdio/plugins/ticket-actions.ts" }],
      pluginsDir: "/fake/repo/.pstdio/plugins",
    }),
    ...overrides,
    log,
  };
};

describe("plugins register", () => {
  test("forces registration for the current project", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ "project-id": undefined }));

    const output = deps.log.mock.calls[0]?.[0] as string;
    expect(output).toContain("Plugins directory: /fake/repo/.pstdio/plugins");
    expect(output).toContain("ticket-actions");
  });

  test("uses --project-id when provided", async () => {
    const registerPlugins = mock(async () => ({ plugins: [], pluginsDir: null }));
    const deps = makeDeps({ registerPlugins });
    const handler = createHandler(deps);

    await handler(argv({ "project-id": "proj-2" }));

    expect(registerPlugins).toHaveBeenCalledWith("proj-2");
  });

  test("throws when no project is specified and no config exists", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ "project-id": undefined }))).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });
});
