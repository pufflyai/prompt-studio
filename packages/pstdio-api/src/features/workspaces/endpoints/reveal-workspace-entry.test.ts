import { describe, expect, test } from "bun:test";
import { resolveRevealCommand, revealWorkspaceEntry } from "./reveal-workspace-entry";

describe("reveal workspace entry", () => {
  test("selects files in Finder and Explorer", () => {
    const entry = { absolutePath: "/project/docs/readme.md", type: "file" as const };

    expect(resolveRevealCommand(entry, "darwin")).toEqual({
      command: "open",
      args: ["-R", "/project/docs/readme.md"],
    });
    expect(resolveRevealCommand(entry, "win32")).toEqual({
      command: "explorer.exe",
      args: ["/select,/project/docs/readme.md"],
    });
  });

  test("opens the containing Linux directory and runs the resolved command", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    await revealWorkspaceEntry({ absolutePath: "/project/docs/readme.md", type: "file" }, "linux", async (command) => {
      commands.push(command);
    });
    await revealWorkspaceEntry({ absolutePath: "/project/docs", type: "directory" }, "linux", async (command) => {
      commands.push(command);
    });

    expect(commands).toEqual([
      { command: "xdg-open", args: ["/project/docs"] },
      { command: "xdg-open", args: ["/project/docs"] },
    ]);
  });
});
