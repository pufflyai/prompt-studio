import { describe, expect, test } from "bun:test";
import { resolveCodexCommand } from "./codex-process";

describe("resolveCodexCommand", () => {
  test("bypasses the Windows npm shim when the native binary is installed", () => {
    const native =
      "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe";

    const command = resolveCodexCommand({
      platform: "win32",
      which: () => "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
      exists: (candidate) => candidate === native,
    });

    expect(command).toBe(native);
  });

  test("switches a Windows .ps1 shim to its sibling .cmd", () => {
    const cmd = "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd";

    const command = resolveCodexCommand({
      platform: "win32",
      which: () => "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.ps1",
      exists: (candidate) => candidate === cmd,
    });

    expect(command).toBe(cmd);
  });
});
