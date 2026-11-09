import { expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

test("module disposal releases its preference adapter and value observations", async () => {
  const core = createWorkbench();
  core.preferences.registerSchema({ properties: { other: { type: "number", scope: "user" } } });
  let released = 0;
  let notices = 0;
  const module = core.registerModule({
    id: "preferences",
    activate(context) {
      context.preferences.registerSchema({ properties: { size: { type: "number", scope: "user" } } });
      context.preferences.registerValueAdapter("size", {
        get: () => 7,
        set: () => {},
        onDidChange: () => () => {
          released++;
        },
      });
      context.preferences.onDidChangeValue(() => notices++);
    },
  });
  module.dispose();
  const disposedNotices = notices;
  core.preferences.setValue("other", 1, { scope: "user" });
  expect(core.preferences.getValue("size")).toBeUndefined();
  expect(released).toBe(1);
  expect(notices).toBe(disposedNotices);
  await core.dispose();
});
