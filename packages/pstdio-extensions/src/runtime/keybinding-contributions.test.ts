import { describe, expect, test } from "bun:test";
import type { RuntimeKeybindingRecord } from "../types/runtime";
import { toKeybindingContributions } from "./keybinding-contributions";

const record = (overrides: Partial<RuntimeKeybindingRecord> = {}): RuntimeKeybindingRecord => ({
  id: "lab.say-hello",
  localId: "say-hello",
  extensionId: "pstdio.extension-lab",
  name: "extension-lab",
  sourcePath: "/extensions/lab/extension.ts",
  commandId: "lab.say-hello",
  key: "mod+shift+h",
  chordId: "mod+shift+H",
  ...overrides,
});

describe("toKeybindingContributions", () => {
  test("maps runtime records to the API contract shape", () => {
    expect(toKeybindingContributions([record({ mac: "cmd+shift+h", when: { resourceType: ["lab.slide"] } })])).toEqual([
      {
        id: "lab.say-hello",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.say-hello",
        key: "mod+shift+h",
        chordId: "mod+shift+H",
        mac: "cmd+shift+h",
        linux: undefined,
        win: undefined,
        args: undefined,
        when: { resourceType: ["lab.slide"] },
      },
    ]);
  });

  test("omits undefined platform overrides without renaming the runtime field", () => {
    const [result] = toKeybindingContributions([record()]);
    expect(result?.mac).toBeUndefined();
    expect(result?.linux).toBeUndefined();
    expect(result?.win).toBeUndefined();
  });
});
