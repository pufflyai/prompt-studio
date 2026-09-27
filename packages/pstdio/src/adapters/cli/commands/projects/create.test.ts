import { afterEach, expect, mock, test } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { createHandler } from "./create";

const originalLog = console.log;
afterEach(() => {
  console.log = originalLog;
});

const cwd = resolve("work", "monorepo", "packages", "研究");
const notes = resolve("notes");
for (const [args, path, name] of [
  [{}, cwd, undefined],
  [{ path: "../1234" }, join(dirname(cwd), "1234"), undefined],
  [{ path: notes, name: "笔记" }, notes, "笔记"],
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
    await createHandler({ cwd: () => cwd, createAndInitProject: open })(args as never);
    expect(open).toHaveBeenCalledWith(path, name);
  });
}
