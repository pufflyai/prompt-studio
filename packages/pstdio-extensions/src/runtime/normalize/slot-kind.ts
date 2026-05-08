import type { UiSlotKind } from "@pstdio/sdk/extensions";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";
import { isRecord } from "./accumulator";

const slotKind = (slot: unknown): UiSlotKind | undefined => {
  if (!isRecord(slot) || typeof slot.kind !== "string") return undefined;
  return slot.kind as UiSlotKind;
};

const slotId = (slot: unknown) => {
  if (typeof slot === "string") return slot;
  if (isRecord(slot) && typeof slot.id === "string") return slot.id;
  return "unknown";
};

export const hasCompatibleSlotKind = (input: {
  runtime: Accumulator;
  source: { extensionId: string; sourcePath: string };
  expected: UiSlotKind;
  slot: unknown;
  contributionId: string;
}) => {
  const { runtime, source, expected, slot, contributionId } = input;
  const actual = slotKind(slot);
  if (!actual || actual === expected) return true;

  runtime.diagnostics.push(
    createDiagnostic({
      code: "invalid_slot_kind",
      message: `Contribution "${contributionId}" targets slot "${slotId(slot)}" with kind "${actual}", expected "${expected}"`,
      extensionId: source.extensionId,
      sourcePath: source.sourcePath,
      metadata: {
        contributionId,
        slotId: slotId(slot),
        expected,
        actual,
      },
    }),
  );
  return false;
};
