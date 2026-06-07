import type { NormalizedExtension, RuntimeKeybindingRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, type RegistryIndex, refId } from "./accumulator";
import { chordContextKey, validateKeybindingContribution } from "./validate-keybinding";

export const registerKeybindings = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const keybindings = source.definition.keybindings;
  if (!keybindings) return;

  for (const [localId, raw] of Object.entries(keybindings)) {
    const keybindingId = `${ext.name}.${localId}`;
    const result = validateKeybindingContribution(raw, {
      keybindingId,
      resolveCommandId: refId,
      hasCommand: (id) => index.commandIds.has(id),
    });

    if (!result.ok) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: result.failure.code,
          message: result.failure.message,
          extensionId: ext.id,
          commandId: result.failure.code === "unknown_keybinding_command" ? result.failure.commandId : undefined,
          sourcePath: source.sourcePath,
          metadata: { keybindingId },
        }),
      );
      continue;
    }

    if (index.keybindingIds.has(keybindingId)) {
      const existing = index.keybindingIds.get(keybindingId);
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_keybinding_id",
          message: `Keybinding id "${keybindingId}" is already provided by ${existing?.sourcePath}`,
          extensionId: ext.id,
          commandId: result.commandId,
          sourcePath: source.sourcePath,
          metadata: { keybindingId },
        }),
      );
      continue;
    }

    const chordKey = chordContextKey(result.value.chordId, result.value.when);
    const existingChord = index.keybindingChords.get(chordKey);
    if (existingChord) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_keybinding_chord",
          severity: "warning",
          message: `Keybinding "${keybindingId}" chord "${result.value.key}" already bound to "${existingChord.commandId}" in the same context; the first binding wins`,
          extensionId: ext.id,
          commandId: result.commandId,
          sourcePath: source.sourcePath,
          metadata: {
            keybindingId,
            conflictsWithId: existingChord.id,
            chordId: result.value.chordId,
          },
        }),
      );
      continue;
    }

    const record: RuntimeKeybindingRecord = {
      id: keybindingId,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      commandId: result.commandId,
      key: result.value.key,
      mac: result.value.mac,
      linux: result.value.linux,
      win: result.value.win,
      chordId: result.value.chordId,
      args: result.value.args,
      when: result.value.when,
    };

    index.keybindingIds.set(keybindingId, record);
    index.keybindingChords.set(chordKey, record);
    runtime.keybindings.push(record);
  }
};
