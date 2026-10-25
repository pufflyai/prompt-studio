import { describe, expect, test } from "bun:test";
import { configureCodeEditor, createCodeEditorPreloader } from "./code-editor";

describe("code editor preloading", () => {
  test("initializes Monaco only once", async () => {
    let initializationCount = 0;
    const initialization = Promise.resolve();
    const preload = createCodeEditorPreloader(() => {
      initializationCount += 1;
      return initialization;
    });

    expect(preload()).toBe(initialization);
    expect(preload()).toBe(initialization);
    await initialization;
    expect(initializationCount).toBe(1);
  });
});

describe("code editor mount behavior", () => {
  test("does not format on mount and keeps formatting as an explicit save shortcut", async () => {
    let formatCount = 0;
    let saveCommand: (() => Promise<void>) | undefined;
    const editor = {
      addCommand: (_key: number, command: () => Promise<void>) => {
        saveCommand = command;
      },
      getAction: () => ({
        run: async () => {
          formatCount += 1;
        },
      }),
    };
    const monaco = {
      KeyMod: { CtrlCmd: 1 },
      KeyCode: { KeyS: 2 },
      languages: {
        typescript: {
          JsxEmit: { React: "react" },
          typescriptDefaults: { setCompilerOptions: () => undefined },
        },
      },
    };

    configureCodeEditor(editor, monaco);

    expect(formatCount).toBe(0);
    await saveCommand?.();
    expect(formatCount).toBe(1);
  });
});
