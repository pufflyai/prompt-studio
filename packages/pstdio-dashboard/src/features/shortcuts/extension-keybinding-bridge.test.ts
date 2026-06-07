import { describe, expect, mock, test } from "bun:test";
import type { ExtensionKeybindingContribution } from "@pstdio/sdk/api";
import {
  createExtensionKeybindingRegistrations,
  matchesKeybindingWhen,
  resolveExtensionHotkey,
} from "./extension-keybinding-bridge";

const make = (overrides: Partial<ExtensionKeybindingContribution>): ExtensionKeybindingContribution => ({
  id: "ext.binding",
  extensionId: "pstdio.ext",
  commandId: "ext.command",
  key: "mod+shift+p",
  chordId: "mod+shift+P",
  ...overrides,
});

describe("resolveExtensionHotkey", () => {
  test("maps `mod` to `Mod` regardless of platform — TanStack hotkeys resolves it per-OS", () => {
    expect(resolveExtensionHotkey(make({ key: "mod+shift+p" }), "darwin") as string).toBe("Mod+Shift+P");
    expect(resolveExtensionHotkey(make({ key: "mod+shift+p" }), "linux") as string).toBe("Mod+Shift+P");
  });

  test("uses the mac override on darwin and falls back to `key` elsewhere", () => {
    const binding = make({ key: "ctrl+shift+h", mac: "cmd+shift+h" });
    expect(resolveExtensionHotkey(binding, "darwin") as string).toBe("Meta+Shift+H");
    expect(resolveExtensionHotkey(binding, "linux") as string).toBe("Control+Shift+H");
  });

  test("uses the win override on win32", () => {
    const binding = make({ key: "ctrl+1", win: "alt+1" });
    expect(resolveExtensionHotkey(binding, "win32") as string).toBe("Alt+1");
  });

  test("returns null when the chord cannot be parsed so we skip registration instead of crashing", () => {
    expect(resolveExtensionHotkey(make({ key: "hyper+x" }), "linux")).toBeNull();
  });

  test("normalizes named keys to their canonical form", () => {
    expect(resolveExtensionHotkey(make({ key: "ctrl+enter" }), "linux") as string).toBe("Control+Enter");
  });
});

describe("matchesKeybindingWhen", () => {
  test("returns true when no when predicate is declared", () => {
    expect(matchesKeybindingWhen(undefined, {})).toBe(true);
  });

  test("gates by resourceType so the chord is ignored without a matching resource", () => {
    const when = { resourceType: ["lab.slide"] };
    expect(matchesKeybindingWhen(when, { resourceType: "lab.slide" })).toBe(true);
    expect(matchesKeybindingWhen(when, { resourceType: "ticket" })).toBe(false);
    expect(matchesKeybindingWhen(when, {})).toBe(false);
  });

  test("gates by mode (string or array) — any active mode matches", () => {
    expect(matchesKeybindingWhen({ mode: "workspace" }, { activeModes: ["workspace"] })).toBe(true);
    expect(matchesKeybindingWhen({ mode: "workspace" }, { activeModes: ["ticket"] })).toBe(false);
    expect(matchesKeybindingWhen({ mode: ["workspace", "preview"] }, { activeModes: ["preview"] })).toBe(true);
    expect(matchesKeybindingWhen({ mode: "workspace" }, {})).toBe(false);
  });

  test("respects source: bindings excluding dashboard never fire from the keybinding bridge", () => {
    expect(matchesKeybindingWhen({ source: ["cli"] }, {})).toBe(false);
    expect(matchesKeybindingWhen({ source: ["dashboard"] }, {})).toBe(true);
    expect(matchesKeybindingWhen({ source: ["cli", "dashboard"] }, {})).toBe(true);
  });

  test("checks when.metadata as shallow equality against active metadata", () => {
    expect(matchesKeybindingWhen({ metadata: { route: "lab" } }, { activeMetadata: { route: "lab" } })).toBe(true);
    expect(matchesKeybindingWhen({ metadata: { route: "lab" } }, { activeMetadata: { route: "planner" } })).toBe(false);
    expect(matchesKeybindingWhen({ metadata: { route: "lab" } }, {})).toBe(false);
  });
});

describe("createExtensionKeybindingRegistrations", () => {
  const sampleBinding = make({
    id: "lab.preview",
    extensionId: "pstdio.lab",
    commandId: "lab.preview",
    key: "mod+shift+h",
  });

  test("invokes the executeCommand with the keybinding slot context when the chord fires (Scenario 1)", () => {
    const executeCommand = mock<(input: { commandId: string; body: unknown }) => void>(() => {});
    const preventDefault = mock(() => {});
    const [registration] = createExtensionKeybindingRegistrations({
      projectId: "project-1",
      keybindings: [sampleBinding],
      platform: "linux",
      executeCommand,
      selectedResource: { type: "lab.slide", id: "slide-1", label: "Intro" },
    });

    expect(registration?.hotkey).toBe("Mod+Shift+H");
    registration?.invoke({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    const call = executeCommand.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      commandId: "lab.preview",
      body: {
        projectId: "project-1",
        source: "dashboard",
        resource: { type: "lab.slide", id: "slide-1" },
        slot: { id: "workbench.keybindings", kind: "keybinding" },
      },
    });
  });

  test("fires from outside the extension webview so long as projectId is set (Scenario 2)", () => {
    const executeCommand = mock<(input: { commandId: string; body: unknown }) => void>(() => {});
    const [registration] = createExtensionKeybindingRegistrations({
      projectId: "project-1",
      keybindings: [sampleBinding],
      platform: "linux",
      executeCommand,
      // No selectedResource: focus is in a host-owned sidebar, not the extension webview
    });
    registration?.invoke();
    expect(executeCommand).toHaveBeenCalledTimes(1);
  });

  test("skips dispatch when the when predicate excludes the active context (Scenario 3)", () => {
    const executeCommand = mock<(input: { commandId: string; body: unknown }) => void>(() => {});
    const binding = make({
      ...sampleBinding,
      when: { resourceType: ["lab.slide"] },
    });
    const [registration] = createExtensionKeybindingRegistrations({
      projectId: "project-1",
      keybindings: [binding],
      platform: "linux",
      executeCommand,
      // Wrong resource type: presentation binding pressed while a ticket is selected
      selectedResource: { type: "ticket", id: "PS-1" },
    });
    registration?.invoke();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  test("skips bindings whose key cannot be parsed instead of crashing", () => {
    const registrations = createExtensionKeybindingRegistrations({
      projectId: "project-1",
      keybindings: [make({ key: "hyper+x" })],
      platform: "linux",
      executeCommand: () => {},
    });
    expect(registrations).toEqual([]);
  });
});
