import type { KeybindingContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";
import { findReservedKeybindingConflicts } from "./reserved-keybindings";
export const reportReservedKeybinding = (
  contribution: KeybindingContribution,
  overrides: { mac?: string; linux?: string; win?: string },
  contributionId: string,
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
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
};
