import type { JsonObject, KeybindingContribution, WhenExpression } from "@pstdio/sdk/extensions";
import { chordCanonicalId, type KeyChord, parseKeyChord } from "./key-chord";

export const PLATFORM_OVERRIDE_KEYS = ["mac", "linux", "win"] as const;
export type PlatformOverrideKey = (typeof PLATFORM_OVERRIDE_KEYS)[number];

export interface ValidatedKeybinding {
  key: string;
  chord: KeyChord;
  chordId: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: WhenExpression;
  args?: JsonObject;
}

export type KeybindingValidationFailure =
  | { code: "invalid_keybinding"; message: string }
  | { code: "unknown_keybinding_command"; message: string; commandId: string };

export interface KeybindingValidationContext {
  /** Stable display id used in diagnostic messages, e.g. `lab.say-hello`. */
  keybindingId: string;
  /** Resolves the contribution's `command` field to a fully qualified id. */
  resolveCommandId(value: unknown): string | null;
  /** Returns true when the given command id is known to the runtime. */
  hasCommand(commandId: string): boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOrUndefined = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * Pure validator for a single keybinding contribution. Both the runtime normalizer and the
 * check command use it so they emit identical diagnostics — platform overrides, command ref
 * resolution, and chord parsing all live in one place.
 */
export const validateKeybindingContribution = (
  raw: unknown,
  ctx: KeybindingValidationContext,
):
  | { ok: true; commandId: string; value: ValidatedKeybinding }
  | { ok: false; failure: KeybindingValidationFailure } => {
  if (!isRecord(raw) || typeof (raw as unknown as KeybindingContribution).key !== "string") {
    return {
      ok: false,
      failure: {
        code: "invalid_keybinding",
        message: `Keybinding "${ctx.keybindingId}" must define a string "key" and a command`,
      },
    };
  }

  const keybinding = raw as unknown as KeybindingContribution;
  const parsed = parseKeyChord(keybinding.key);
  if (!parsed.ok) {
    return {
      ok: false,
      failure: {
        code: "invalid_keybinding",
        message: `Keybinding "${ctx.keybindingId}" key "${keybinding.key}" is invalid: ${parsed.reason}`,
      },
    };
  }

  for (const platform of PLATFORM_OVERRIDE_KEYS) {
    const override = keybinding[platform];
    if (override === undefined) continue;
    if (typeof override !== "string") {
      return {
        ok: false,
        failure: {
          code: "invalid_keybinding",
          message: `Keybinding "${ctx.keybindingId}" ${platform} override must be a string`,
        },
      };
    }
    const platformParsed = parseKeyChord(override);
    if (!platformParsed.ok) {
      return {
        ok: false,
        failure: {
          code: "invalid_keybinding",
          message: `Keybinding "${ctx.keybindingId}" ${platform} key "${override}" is invalid: ${platformParsed.reason}`,
        },
      };
    }
  }

  const commandId = ctx.resolveCommandId(keybinding.command);
  if (!commandId) {
    return {
      ok: false,
      failure: {
        code: "invalid_keybinding",
        message: `Keybinding "${ctx.keybindingId}" command reference is missing or empty`,
      },
    };
  }
  if (!ctx.hasCommand(commandId)) {
    return {
      ok: false,
      failure: {
        code: "unknown_keybinding_command",
        commandId,
        message: `Keybinding "${ctx.keybindingId}" targets unknown command "${commandId}"`,
      },
    };
  }

  return {
    ok: true,
    commandId,
    value: {
      key: keybinding.key,
      chord: parsed.chord,
      chordId: chordCanonicalId(parsed.chord),
      mac: stringOrUndefined(keybinding.mac),
      linux: stringOrUndefined(keybinding.linux),
      win: stringOrUndefined(keybinding.win),
      when: isRecord(keybinding.when) ? (keybinding.when as WhenExpression) : undefined,
      args: isRecord(keybinding.args) ? (keybinding.args as JsonObject) : undefined,
    },
  };
};

/**
 * Stable string for chord+context dedupe so two bindings can share a key under different
 * `when`s. Accepts any `when`-shaped object so both runtime and API contract types can use
 * the same helper without lossy casts.
 */
export const chordContextKey = (chordId: string, when?: object | null) =>
  when ? `${chordId}|${JSON.stringify(when)}` : `${chordId}|`;
