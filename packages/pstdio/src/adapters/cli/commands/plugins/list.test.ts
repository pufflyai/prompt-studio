import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./list";
import type { PluginsArgs } from "./shared";

const argv = (args: Partial<PluginsArgs>) => ({ _: [], $0: "", ...args }) as Arguments<PluginsArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/repo",
    findGitRoot: () => "/fake/repo",
    readConfig: () => ({ project_id: "proj-1" }),
    listPlugins: async () => ({
      plugins: [
        { identity: "ticket-actions", filePath: "/fake/repo/.pstdio/plugins/ticket-actions.ts" },
        { identity: "workspace-actions", filePath: "/fake/repo/.pstdio/plugins/workspace-actions.ts" },
      ],
      pluginsDir: "/fake/repo/.pstdio/plugins",
    }),
    ...overrides,
    log,
  };
};

describe("plugins list", () => {
  test("prints registered plugins for the current project", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ "project-id": undefined }));

    const output = deps.log.mock.calls[0]?.[0] as string;
    expect(output).toContain("Plugins directory: /fake/repo/.pstdio/plugins");
    expect(output).toContain("ticket-actions");
    expect(output).toContain("/fake/repo/.pstdio/plugins/ticket-actions.ts");
    expect(output).toContain("workspace-actions");
  });

  test("prints a message when no plugins are registered", async () => {
    const deps = makeDeps({
      listPlugins: async () => ({ plugins: [], pluginsDir: "/fake/repo/.pstdio/plugins" }),
    });
    const handler = createHandler(deps);

    await handler(argv({ "project-id": undefined }));

    expect(deps.log).toHaveBeenCalledWith("No plugins registered for this project.");
  });

  test("uses --project-id when provided", async () => {
    const listPlugins = mock(async () => ({ plugins: [], pluginsDir: null }));
    const deps = makeDeps({ listPlugins });
    const handler = createHandler(deps);

    await handler(argv({ "project-id": "proj-2" }));

    expect(listPlugins).toHaveBeenCalledWith("proj-2");
  });

  test("throws when no project is specified and no config exists", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ "project-id": undefined }))).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });
});
