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
  expect(selected).toEqual([[], ["pstdio-base-themes", "pstdio-skills"]]);
  expect(await state.read(context)).toMatchObject({ completed: true, harnesses: [], workAreas: [] });
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
