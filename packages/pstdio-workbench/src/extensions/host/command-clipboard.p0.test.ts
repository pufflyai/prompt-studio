import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

test("extension commands copy opted-in text results and leave ordinary results alone", async () => {
  const workbench = createWorkbench();
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const previousItem = Object.getOwnPropertyDescriptor(globalThis, "ClipboardItem");
  Object.defineProperty(globalThis, "ClipboardItem", {
    configurable: true,
    value: class {
      constructor(private data: Record<string, Promise<Blob>>) {}
      getType(type: string) {
        return this.data[type];
      }
    },
  });
  const copied: string[] = [];
  let writesStarted = 0;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      write: async (items: ClipboardItem[]) => {
        writesStarted++;
        copied.push(await (await items[0]!.getType("text/plain")).text());
      },
    },
  });
  let result: unknown = "exact-reference";
  const context = {
    projectId: "project",
    workbench,
    metadata: {
      commands: [{ id: "copy", extensionId: "acme.tool", title: "Copy reference", copyResultToClipboard: true }],
    },
    executeCommand: () => ({ outcome: { ok: true, status: "success", value: result } }),
  };
  try {
    let finish!: (response: unknown) => void;
    const pending = executeWorkbenchExtensionCommand(
      {
        ...context,
        executeCommand: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
      "copy",
    );
    expect(writesStarted).toBe(1);
    finish({ outcome: { ok: true, status: "success", value: "exact-reference" } });
    expect(await pending).toBe("exact-reference");
    expect(copied).toEqual(["exact-reference"]);
    await executeWorkbenchExtensionCommand(context, "ordinary");
    expect(copied).toHaveLength(1);
    result = "late-reference";
    const controller = new AbortController();
    let complete!: (response: unknown) => void;
    const cancelled = executeWorkbenchExtensionCommand(
      {
        ...context,
        executeCommand: () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      },
      "copy",
      { signal: controller.signal },
    );
    controller.abort(new Error("Cancelled"));
    complete({ outcome: { ok: true, status: "success", value: result } });
    await expect(cancelled).rejects.toThrow("Cancelled");
    await expect(executeWorkbenchExtensionCommand(context, "copy", { isViewerCurrent: () => false })).rejects.toThrow(
      "viewer is closed",
    );
    await expect(
      executeWorkbenchExtensionCommand(
        {
          ...context,
          executeCommand: () => ({ outcome: { ok: false, status: "error", reason: "Command failed" } }),
        },
        "copy",
      ),
    ).rejects.toThrow("Command failed");
    expect(copied).toHaveLength(1);
    result = { reference: "not-text" };
    await expect(executeWorkbenchExtensionCommand(context, "copy")).rejects.toThrow("text result");
    expect(copied).toHaveLength(1);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async () => {
          throw new Error("Clipboard permission denied");
        },
      },
    });
    result = "reference";
    await expect(executeWorkbenchExtensionCommand(context, "copy")).rejects.toThrow("Clipboard permission denied");
  } finally {
    if (previous) Object.defineProperty(navigator, "clipboard", previous);
    else Reflect.deleteProperty(navigator, "clipboard");
    if (previousItem) Object.defineProperty(globalThis, "ClipboardItem", previousItem);
    else Reflect.deleteProperty(globalThis, "ClipboardItem");
    workbench.dispose();
  }
});
