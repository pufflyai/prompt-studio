import { expect, test } from "bun:test";
import type { Disposable } from "./shared/disposable";
import { createWorkbench } from "./workbench-core";

test("disposing a child module preserves parent context when both share a contribution owner", () => {
  const workbench = createWorkbench();
  let child: Disposable | undefined;
  const parent = workbench.registerModule({
    id: "extensions",
    activate(ctx) {
      ctx.context.set("templates.editable", true);
      child = ctx.registerChildModule({
        id: "extensions.contributions",
        ownerId: "extensions",
        activate(childCtx) {
          childCtx.context.set("extension.ready", true);
        },
      });
    },
  });

  child?.dispose();

  expect(workbench.context.get("templates.editable")).toBe(true);
  expect(workbench.context.get("extension.ready")).toBeUndefined();
  parent.dispose();
  expect(workbench.context.get("templates.editable")).toBeUndefined();
});

test("disposing a mode preserves its module context", () => {
  const workbench = createWorkbench();
  let mode: Disposable | undefined;
  const module = workbench.registerModule({
    id: "extension",
    activate(ctx) {
      ctx.context.set("extension.ready", true);
      mode = ctx.modes.registerMode({
        id: "extension.mode",
        activate(modeCtx) {
          modeCtx.context.set("mode.ready", true);
        },
      });
    },
  });
  workbench.modes.setActiveMode("extension.mode");
  mode?.dispose();

  expect(workbench.context.get("extension.ready")).toBe(true);
  expect(workbench.context.get("mode.ready")).toBeUndefined();
  module.dispose();
});
