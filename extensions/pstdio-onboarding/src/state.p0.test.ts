import { expect, test } from "bun:test";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { createSetupState } from "./state";

const fixture = () => {
  const values = new Map<string, unknown>([["hidden", false]]);
  const selected: string[][] = [];
  const context = {
    settings: {
      get: async (key: string) => values.get(key),
      set: async (key: string, value: unknown) => {
        values.set(key, value);
      },
    },
    extensions: {
      list: async () => ({
        extensions: [],
        marketplace: [{ extensionId: "pstdio.pstdio-skill-browser", installName: "pstdio-skill-browser" }],
      }),
      install: async (names: string[]) => {
        selected.push(names);
      },
    },
  } as unknown as ExtensionContextBase;
  return { selected, context, state: createSetupState() };
};
test("remembered choices use device settings while explicit selection queues the current project", async () => {
  const { context, state, selected } = fixture();
  await state.update(context, { step: "harnesses", harnesses: ["codex", "codex"] });
  expect(selected).toEqual([["harness-codex"]]);
  expect((await state.read(context)).harnesses).toEqual(["codex"]);
  expect((await createSetupState().read(context)).harnesses).toEqual(["codex"]);
});
test("Skip and visibility save without installing unsubmitted choices", async () => {
  const { context, state, selected } = fixture();
  await state.update(context, { step: "visibility", hidden: true });
  expect(await state.read(context)).toMatchObject({ hidden: true, completed: false });
  await state.update(context, { step: "skip" });
  expect(await state.read(context)).toMatchObject({ hidden: true, completed: true });
  expect(selected).toEqual([]);
});
test("no harness and no work keep foundation defaults without optional tools", async () => {
  const { context, state, selected } = fixture();
  await state.update(context, { step: "harnesses", harnesses: [] });
  await state.update(context, { step: "complete", workAreas: [] });
  expect(selected).toEqual([[], ["base-themes", "skills"]]);
  expect(await state.read(context)).toMatchObject({ completed: true, harnesses: [], workAreas: [] });
});
test("Coding installs Workspaces with its selected tools", async () => {
  const { context, state, selected } = fixture();
  await state.update(context, { step: "complete", workAreas: ["coding"] });
  expect(selected).toEqual([
    [
      "workspaces",
      "pstdio-terminal",
      "planner",
      "reports",
      "artifacts",
      "pstdio-skill-browser",
      "base-themes",
      "skills",
    ],
  ]);
});
test("Project planning installs its selected tools", async () => {
  const { context, state, selected } = fixture();
  await state.update(context, { step: "complete", workAreas: ["planning"] });
  expect(selected).toEqual([["planner", "notes", "reports", "base-themes", "skills"]]);
});
test("a failed durable selection leaves remembered choices editable for recovery", async () => {
  const { context, state } = fixture();
  context.extensions!.install = async () => {
    throw new Error("catalog unavailable");
  };
  await expect(state.update(context, { step: "harnesses", harnesses: ["pi"] })).rejects.toThrow("catalog unavailable");
  expect((await state.read(context)).harnesses).toBeNull();
  context.extensions!.install = async () => {};
  expect(await state.update(context, { step: "harnesses", harnesses: ["pi"] })).toMatchObject({ harnesses: ["pi"] });
});

test("device preferences remain readable when catalog and harness detection are unavailable", async () => {
  const { context, state } = fixture();
  await state.update(context, { step: "visibility", hidden: true });
  context.extensions!.list = async () => {
    throw new Error("catalog unavailable");
  };
  const { commands } = await import("./commands");
  expect(await commands.preferences.run(context as never, {})).toMatchObject({ hidden: true });
});

test("Coding completion survives a host catalog without the optional Skill Browser", async () => {
  const { context, state, selected } = fixture();
  context.extensions!.list = async () => ({ extensions: [], marketplace: [] });
  await state.update(context, { step: "complete", workAreas: ["coding"] });
  expect(selected).toEqual([
    ["workspaces", "pstdio-terminal", "planner", "reports", "artifacts", "base-themes", "skills"],
  ]);
  expect(await state.read(context)).toMatchObject({ completed: true, workAreas: ["coding"] });
});

test("Coding install failures still leave completion editable", async () => {
  const { context, state } = fixture();
  context.extensions!.install = async () => {
    throw Error("installation failed");
  };
  await expect(state.update(context, { step: "complete", workAreas: ["coding"] })).rejects.toThrow(
    "installation failed",
  );
  expect((await state.read(context)).completed).toBe(false);
});

test.each([
  true,
  false,
])("Coding completes with an installed Skill Browser absent from the catalog (enabled=%s)", async (enabled) => {
  const { context, state, selected } = fixture();
  context.extensions!.list = async () =>
    ({
      extensions: [{ extensionId: "pstdio.pstdio-skill-browser", enabled }],
      marketplace: [],
    }) as never;
  const install = context.extensions!.install;
  context.extensions!.install = async (names) => {
    // The host validates catalog names before accepting any of the installation batch.
    if (names.includes("pstdio-skill-browser")) throw Error("Unknown catalog extension: pstdio-skill-browser");
    await install(names);
  };
  await state.update(context, { step: "complete", workAreas: ["coding"] });
  expect(selected).toEqual([
    ["workspaces", "pstdio-terminal", "planner", "reports", "artifacts", "base-themes", "skills"],
  ]);
  expect(await state.read(context)).toMatchObject({ completed: true, workAreas: ["coding"] });
});
