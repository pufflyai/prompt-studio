import type { ExtensionKeybindingContribution } from "@pstdio/sdk/api";
import { matchesResourceWhen } from "@pstdio/sdk/extensions";
import { getHotkeyManager, type Hotkey } from "@tanstack/hotkeys";
import { type KeyChordModifier, parseKeyChord } from "pstdio-extensions/key-chord";
import { useEffect } from "react";
import {
  useExecuteExtensionCommand,
  useProjectExtensionMetadata,
} from "@/shared/extensions/hooks/use-project-extensions";
import { buildExtensionCommandRequest } from "@/shared/extensions/slot-context";
import type { ExtensionResourceContext } from "@/shared/extensions/types";

export interface ExtensionKeybindingDispatchContext {
  /** Active workbench-ish modes for `when.mode` matching (route-derived + any extension-active). */
  activeModes?: readonly string[];
  /** Active dashboard metadata for `when.metadata` shallow equality (e.g. resource metadata). */
  activeMetadata?: Record<string, unknown>;
  /** Active resource the chord should be invoked against. Flows into `when.resourceType` and into the slot payload. */
  selectedResource?: ExtensionResourceContext;
}

interface ExtensionKeybindingBridgeProps extends ExtensionKeybindingDispatchContext {
  projectId: string;
}

const MODIFIER_MAP: Record<KeyChordModifier, string> = {
  mod: "Mod",
  cmd: "Meta",
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
};

const resolveExtensionHotkey = (
  keybinding: ExtensionKeybindingContribution,
  platform: NodeJS.Platform,
): Hotkey | null => {
  const platformOverride =
    platform === "darwin" ? keybinding.mac : platform === "win32" ? keybinding.win : keybinding.linux;
  const raw = platformOverride ?? keybinding.key;
  const parsed = parseKeyChord(raw);
  if (!parsed.ok) return null;
  const segments = [...parsed.chord.modifiers.map((modifier) => MODIFIER_MAP[modifier]), parsed.chord.key];
  return segments.join("+") as Hotkey;
};

const includesMode = (mode: string | string[] | undefined, active: readonly string[]) => {
  if (!mode) return true;
  if (Array.isArray(mode)) return mode.some((value) => active.includes(value));
  return active.includes(mode);
};

const matchesMetadata = (expected: Record<string, unknown> | undefined, actual: Record<string, unknown>) => {
  if (!expected) return true;
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) return false;
  }
  return true;
};

/**
 * Evaluates the full `when` predicate at dispatch time. Keybindings always invoke commands as
 * the `dashboard` source, so a binding that excludes "dashboard" should never fire.
 * `when.metadata` is checked shallowly: every declared key must match the active context bag.
 */
export const matchesKeybindingWhen = (
  when: ExtensionKeybindingContribution["when"],
  context: { resourceType?: string; activeModes?: readonly string[]; activeMetadata?: Record<string, unknown> },
) => {
  if (!when) return true;
  if (!matchesResourceWhen({ resourceType: when.resourceType }, context.resourceType)) return false;
  if (!includesMode(when.mode, context.activeModes ?? [])) return false;
  if (when.source && !when.source.includes("dashboard")) return false;
  if (!matchesMetadata(when.metadata, context.activeMetadata ?? {})) return false;
  return true;
};

const getPlatform = (): NodeJS.Platform => {
  if (typeof navigator === "undefined") return "linux";
  if (/Mac/i.test(navigator.platform)) return "darwin";
  if (/Win/i.test(navigator.platform)) return "win32";
  return "linux";
};

export interface ExtensionKeybindingRegistration {
  hotkey: Hotkey;
  keybinding: ExtensionKeybindingContribution;
  invoke(event?: { preventDefault?: () => void }): void;
}

export interface CreateExtensionKeybindingRegistrationsInput extends ExtensionKeybindingDispatchContext {
  projectId: string;
  keybindings: ExtensionKeybindingContribution[];
  platform: NodeJS.Platform;
  executeCommand(input: { commandId: string; body: unknown }): void;
}

/**
 * Pure factory shared by the React bridge and tests. Produces one registration per binding
 * whose `key` resolves on the given platform; each registration captures the `when` checks
 * and the slot payload that the dashboard sends when the chord fires.
 */
export const createExtensionKeybindingRegistrations = (
  input: CreateExtensionKeybindingRegistrationsInput,
): ExtensionKeybindingRegistration[] => {
  const { projectId, keybindings, platform, executeCommand, selectedResource, activeModes, activeMetadata } = input;
  return keybindings.flatMap((keybinding) => {
    const hotkey = resolveExtensionHotkey(keybinding, platform);
    if (!hotkey) return [];
    return [
      {
        hotkey,
        keybinding,
        invoke(event) {
          if (
            !matchesKeybindingWhen(keybinding.when, {
              resourceType: selectedResource?.type,
              activeModes,
              activeMetadata,
            })
          ) {
            return;
          }
          event?.preventDefault?.();
          executeCommand({
            commandId: keybinding.commandId,
            body: buildExtensionCommandRequest({
              projectId,
              slotId: "workbench.keybindings",
              kind: "keybinding",
              resource: selectedResource,
              params: keybinding.args ?? undefined,
            }),
          });
        },
      },
    ];
  });
};

export { resolveExtensionHotkey };

export const ExtensionKeybindingBridge = (props: ExtensionKeybindingBridgeProps) => {
  const { projectId, selectedResource, activeModes, activeMetadata } = props;
  const { data: metadata } = useProjectExtensionMetadata(projectId);
  const executeExtensionCommand = useExecuteExtensionCommand(projectId);
  const keybindings = metadata?.keybindings;

  useEffect(() => {
    if (!projectId || !keybindings || keybindings.length === 0) return;
    const manager = getHotkeyManager();
    const registrations = createExtensionKeybindingRegistrations({
      projectId,
      keybindings,
      platform: getPlatform(),
      selectedResource,
      activeModes,
      activeMetadata,
      executeCommand: (input) => executeExtensionCommand.mutate(input),
    });
    const handles = registrations.map((registration) =>
      manager.register(registration.hotkey, (event) => registration.invoke(event), {
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
      }),
    );

    return () => {
      for (const handle of handles) handle.unregister();
    };
  }, [activeMetadata, activeModes, executeExtensionCommand, keybindings, projectId, selectedResource]);

  return null;
};
