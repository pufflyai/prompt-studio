import { describe, expect, test } from "bun:test";
import { findReservedKeybindingConflict, findReservedKeybindingConflicts } from "./reserved-keybindings";

describe("findReservedKeybindingConflict", () => {
  test("flags Ctrl+Shift+P on Linux/Windows as the DevTools/private-window chord", () => {
    const linux = findReservedKeybindingConflict("ctrl+shift+p", "linux");
    const win = findReservedKeybindingConflict("ctrl+shift+p", "win");

    expect(linux?.reason).toBe("browser_private_window");
    expect(linux?.canonicalChord).toBe("Mod+Shift+P");
    expect(win?.reason).toBe("browser_private_window");
  });

  test("flags Cmd+Shift+P on macOS via the Mod alias", () => {
    const conflict = findReservedKeybindingConflict("cmd+shift+p", "mac");
    expect(conflict?.canonicalChord).toBe("Mod+Shift+P");
  });

  test("flags Mod+T as the new-tab chord across platforms", () => {
    expect(findReservedKeybindingConflict("mod+t", "mac")?.reason).toBe("browser_new_tab");
    expect(findReservedKeybindingConflict("ctrl+t", "linux")?.reason).toBe("browser_new_tab");
    expect(findReservedKeybindingConflict("ctrl+t", "win")?.reason).toBe("browser_new_tab");
  });

  test("flags Ctrl+J as browser downloads on Linux and Windows", () => {
    expect(findReservedKeybindingConflict("ctrl+j", "linux")?.reason).toBe("browser_downloads");
    expect(findReservedKeybindingConflict("ctrl+j", "win")?.reason).toBe("browser_downloads");
    expect(findReservedKeybindingConflict("cmd+j", "mac")).toBeUndefined();
  });

  test("flags Ctrl+Shift+K as Firefox DevTools on Linux and Windows", () => {
    expect(findReservedKeybindingConflict("ctrl+shift+k", "linux")?.reason).toBe("browser_devtools");
    expect(findReservedKeybindingConflict("ctrl+shift+k", "win")?.reason).toBe("browser_devtools");
    expect(findReservedKeybindingConflict("cmd+shift+k", "mac")).toBeUndefined();
  });

  test("flags Ctrl+Alt+T as the Linux terminal shortcut", () => {
    expect(findReservedKeybindingConflict("ctrl+alt+t", "linux")?.reason).toBe("os_terminal");
    expect(findReservedKeybindingConflict("cmd+option+t", "mac")).toBeUndefined();
    expect(findReservedKeybindingConflict("ctrl+alt+t", "win")).toBeUndefined();
  });

  test("flags platform-scoped Mod+Alt+Arrow browser and OS shortcuts", () => {
    expect(findReservedKeybindingConflict("cmd+option+arrowleft", "mac")?.reason).toBe("os_window_navigation");
    expect(findReservedKeybindingConflict("cmd+option+arrowright", "mac")?.reason).toBe("os_window_navigation");
    expect(findReservedKeybindingConflict("ctrl+alt+arrowleft", "linux")?.reason).toBe("os_window_navigation");
    expect(findReservedKeybindingConflict("ctrl+alt+arrowright", "linux")?.reason).toBe("os_window_navigation");
    expect(findReservedKeybindingConflict("ctrl+alt+arrowleft", "win")?.reason).toBe("browser_tab_navigation");
    expect(findReservedKeybindingConflict("ctrl+alt+arrowright", "win")?.reason).toBe("browser_tab_navigation");
  });

  test("does not flag chords outside the reserved table", () => {
    expect(findReservedKeybindingConflict("mod+k", "mac")).toBeUndefined();
    expect(findReservedKeybindingConflict("ctrl+k", "linux")).toBeUndefined();
    expect(findReservedKeybindingConflict("alt+shift+x", "win")).toBeUndefined();
  });

  test("scopes platform-specific entries to the right platform", () => {
    expect(findReservedKeybindingConflict("F11", "linux")?.reason).toBe("browser_fullscreen");
    expect(findReservedKeybindingConflict("F11", "win")?.reason).toBe("browser_fullscreen");
    expect(findReservedKeybindingConflict("F11", "mac")).toBeUndefined();
  });
});

describe("findReservedKeybindingConflicts", () => {
  test("returns every conflicting platform override", () => {
    const conflicts = findReservedKeybindingConflicts({
      mac: "mod+x",
      linux: "ctrl+shift+p",
      win: "ctrl+shift+p",
    });

    expect(conflicts).toMatchObject([
      { platform: "linux", canonicalChord: "Mod+Shift+P" },
      { platform: "win", canonicalChord: "Mod+Shift+P" },
    ]);
  });

  test("returns an empty list when none of the platforms conflict", () => {
    expect(
      findReservedKeybindingConflicts({
        mac: "mod+k",
        linux: "ctrl+k",
        win: "ctrl+k",
      }),
    ).toEqual([]);
  });
});
