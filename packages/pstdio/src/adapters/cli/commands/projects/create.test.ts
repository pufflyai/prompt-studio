import { afterEach, expect, mock, test } from "bun:test";
import { createHandler } from "./create";

const originalLog = console.log;
afterEach(() => {
  console.log = originalLog;
});

for (const [args, path, name] of [
  [{}, "/work/monorepo/packages/研究", undefined],
  [{ path: "../1234" }, "/work/monorepo/packages/1234", undefined],
  [{ path: "/notes", name: "笔记" }, "/notes", "笔记"],
] as const) {
  test(`opens the exact selected folder ${path}`, async () => {
    const open = mock(async () => ({
      id: "project",
      name: name ?? "Folder",
      shorthand: "P",
      default_agent_id: null,
      default_agent_model: null,
      startup_script: null,
      created_at: "",
      updated_at: "",
      deleted_at: null,
    }));
    console.log = mock();
    await createHandler({ cwd: () => "/work/monorepo/packages/研究", createAndInitProject: open })(args as never);
    expect(open).toHaveBeenCalledWith(path, name);
  });
}
