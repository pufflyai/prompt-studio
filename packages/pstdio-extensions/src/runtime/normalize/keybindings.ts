import type { JsonObject, KeybindingContribution, WhenExpression } from "@pstdio/sdk/extensions";
import { normalizeHotkey, parseHotkey, validateHotkey } from "@tanstack/hotkeys";
import type { NormalizedExtension, ParsedKeybindingChord, RuntimeKeybindingRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { findReservedKeybindingConflicts } from "./reserved-keybindings";

const PLATFORM_KEYS = ["mac", "linux", "win"] as const;
const TANSTACK_PLATFORMS = { linux: "linux", mac: "mac", win: "windows" } as const;
const MODIFIER_KEY_NAMES = new Set(["alt", "cmd", "command", "control", "ctrl", "meta", "mod", "shift"]);

// `JSON.stringify` honors property-insertion order, so `{mode: "x", source: ["a"]}`
// and `{source: ["a"], mode: "x"}` produce different strings — hiding a real
// conflict. The canonical key sorts object keys recursively to dedupe them.
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
};

const stableWhenKey = (when: WhenExpression | undefined) => (when ? stableStringify(when) : "");

const toParsedChord = (chord: string): ParsedKeybindingChord => {
  const parsed = parseHotkey(chord, "mac");
  return {
    key: parsed.key,
    ctrl: parsed.ctrl,
    shift: parsed.shift,
    alt: parsed.alt,
    meta: parsed.meta,
    modifiers: [...parsed.modifiers],
  };
};

const validateChord = (
  chord: string,
  field: string,
  contributionId: string,
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  const result = validateHotkey(chord);
  const parsed = result.valid ? parseHotkey(chord, "mac") : undefined;
  const hasNonModifierKey = parsed?.key ? !MODIFIER_KEY_NAMES.has(parsed.key.toLowerCase()) : false;
  if (result.valid && hasNonModifierKey) return true;

  const errors = result.valid ? ["Hotkey must include a non-modifier key"] : result.errors;

  runtime.diagnostics.push(
    createDiagnostic({
      code: "invalid_keybinding",
      message: `Keybinding "${contributionId}" has an invalid ${field} "${chord}": ${errors.join("; ")}`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
      metadata: { contributionId, field, chord, errors: errors as unknown as JsonObject[string] },
    }),
  );
  return false;
};

const collectPlatformOverrides = (contribution: KeybindingContribution) => {
  const overrides: { mac?: string; linux?: string; win?: string } = {};
  for (const key of PLATFORM_KEYS) {
    const value = contribution[key];
    if (typeof value === "string" && value.length > 0) overrides[key] = value;
  }
  return overrides;
};

export const keybindingDedupeEntries = (contribution: {
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: WhenExpression;
}) => {
  const whenKey = stableWhenKey(contribution.when);
  return PLATFORM_KEYS.map((platform) => {
    const chord = contribution[platform] ?? contribution.key;
    const canonicalChord = normalizeHotkey(chord, TANSTACK_PLATFORMS[platform]);
    return {
      platform,
      chord,
      canonicalChord,
      key: `${platform}::${canonicalChord}::${whenKey}`,
    };
  });
};

const validatePlatformOverrides = (
  overrides: ReturnType<typeof collectPlatformOverrides>,
  contributionId: string,
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  for (const platform of PLATFORM_KEYS) {
    const chord = overrides[platform];
    if (!chord) continue;
    if (!validateChord(chord, platform, contributionId, ext, source, runtime)) return false;
  }
  return true;
};

const resolveCommandId = (
  contribution: KeybindingContribution,
  contributionId: string,
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const ref = refId(contribution.command);
  if (!ref) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "invalid_keybinding",
        message: `Keybinding "${contributionId}" must reference a command`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
        metadata: { contributionId },
      }),
    );
    return undefined;
  }

  const commandId = ref.includes(".") ? ref : `${ext.name}.${ref}`;
  if (!index.commandIds.has(commandId)) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "extension_keybinding_command_missing",
        message: `Keybinding "${contributionId}" references unknown command "${commandId}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
        metadata: { contributionId, commandId },
      }),
    );
    return undefined;
  }

  return commandId;
};

const findDuplicateKeybinding = (
  contribution: KeybindingContribution,
  overrides: ReturnType<typeof collectPlatformOverrides>,
  index: RegistryIndex,
) => {
  for (const entry of keybindingDedupeEntries({ ...contribution, ...overrides })) {
    const existing = index.keybindingDedupe.get(entry.key);
    if (existing) return { ...entry, existing };
  }
  return undefined;
};

const addKeybindingDedupeEntries = (
  record: RuntimeKeybindingRecord,
  overrides: ReturnType<typeof collectPlatformOverrides>,
  index: RegistryIndex,
) => {
  for (const entry of keybindingDedupeEntries({ ...record.contribution, ...overrides, when: record.when })) {
    index.keybindingDedupe.set(entry.key, record);
  }
};

export const registerKeybindings = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, raw] of Object.entries(source.definition.keybindings ?? {})) {
    const contributionId = `${ext.name}.${localId}`;

    if (!isRecord(raw) || typeof raw.key !== "string" || raw.key.length === 0) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_keybinding",
          message: `Keybinding "${contributionId}" must declare a non-empty "key"`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId },
        }),
      );
      continue;
    }

    const contribution = raw as KeybindingContribution;
    if (!validateChord(contribution.key, "key", contributionId, ext, source, runtime)) continue;

    const overrides = collectPlatformOverrides(contribution);
    if (!validatePlatformOverrides(overrides, contributionId, ext, source, runtime)) continue;

    const commandId = resolveCommandId(contribution, contributionId, ext, source, runtime, index);
    if (!commandId) continue;

    const canonicalChord = normalizeHotkey(contribution.key, "mac");
    const reservedConflicts = findReservedKeybindingConflicts({
      mac: overrides.mac ?? contribution.key,
      linux: overrides.linux ?? contribution.key,
      win: overrides.win ?? contribution.key,
    });
    if (reservedConflicts.length > 0) {
      const [firstConflict] = reservedConflicts;
      const platforms = reservedConflicts.map((conflict) => conflict.platform);
      const conflicts = reservedConflicts.map((conflict) => ({
        platform: conflict.platform,
        chord: conflict.chord,
        canonicalChord: conflict.canonicalChord,
        reason: conflict.reason,
        description: conflict.description,
      }));
      runtime.diagnostics.push(
        createDiagnostic({
          code: "reserved_keybinding_chord",
          severity: "warning",
          message: `Keybinding "${contributionId}" uses reserved chord "${firstConflict!.canonicalChord}" on ${platforms.join(", ")} (${firstConflict!.description})`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: {
            contributionId,
            canonicalChord: firstConflict!.canonicalChord,
            platform: firstConflict!.platform,
            reason: firstConflict!.reason,
            platforms,
            conflicts,
          },
        }),
      );
    }

    const duplicate = findDuplicateKeybinding(contribution, overrides, index);
    if (duplicate) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_keybinding_chord",
          severity: "warning",
          message: `Keybinding "${contributionId}" duplicates "${duplicate.existing.id}" on ${duplicate.platform} (canonical chord "${duplicate.canonicalChord}")`,
          extensionId: ext.id,
          commandId,
          sourcePath: source.sourcePath,
          metadata: {
            contributionId,
            canonicalChord: duplicate.canonicalChord,
            platform: duplicate.platform,
            existingId: duplicate.existing.id,
            existingExtensionId: duplicate.existing.extensionId,
          },
        }),
      );
      continue;
    }

    const record: RuntimeKeybindingRecord = {
      id: contributionId,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      commandId,
      contribution,
      canonicalChord,
      parsed: toParsedChord(contribution.key),
      when: contribution.when as WhenExpression | undefined,
    };

    addKeybindingDedupeEntries(record, overrides, index);
    runtime.keybindings.push(record);
  }
};
