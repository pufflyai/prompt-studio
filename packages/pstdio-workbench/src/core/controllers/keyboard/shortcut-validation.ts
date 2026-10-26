import { normalizeHotkey, validateHotkey } from "@tanstack/hotkeys";
import { getKeybindingSteps } from "../../registries/keybindings/keybinding-registry";
import { type ShortcutAssignment, sharedShortcutLayer } from "../../registries/keybindings/shortcut-preferences";
import type { WorkbenchCore } from "../../workbench-core-types";

export const validateShortcutAlias = (aliases: Record<string, string>, id: string, alias: string) => {
  if (alias && !/^[A-Z0-9]+$/.test(alias)) throw new Error("Use letters and numbers for an alias.");
  if (
    alias &&
    Object.entries(aliases).some(
      ([owner, value]) => owner !== id && (value.startsWith(alias) || alias.startsWith(value)),
    )
  )
    throw new Error("An alias cannot share a prefix with another extension.");
};
export const validateShortcutAssignment = (core: WorkbenchCore, id: string, assignment: ShortcutAssignment) => {
  if (assignment.disabled) return;
  const binding = core.keybindings.listCatalog().find((binding) => core.keybindings.getId(binding) === id);
  const assigned = assignment.layer === "direct" ? undefined : (assignment.layer ?? binding?.layer);
  const layer = assigned ? sharedShortcutLayer(assigned) : undefined;
  const steps = getKeybindingSteps(assignment.keybinding ?? binding?.keybinding ?? "");
  if (!steps.length) return;
  if (layer) {
    if (steps.some((step) => !(/^[a-z0-9]$/i.test(step) || step === "ArrowLeft" || step === "ArrowRight")))
      throw new Error("Layer shortcuts use letters or numbers separated by spaces.");
    const key = steps.join(" ").toUpperCase();
    const overlap = core.keyboard.catalog().some((candidate) => {
      if (candidate.id === id || candidate.binding.layer !== layer) return false;
      const other = getKeybindingSteps(candidate.binding.keybinding).join(" ").toUpperCase();
      return other && (other.startsWith(`${key} `) || key.startsWith(`${other} `));
    });
    if (overlap) throw new Error("A layer shortcut cannot share a strict prefix with another shortcut.");
    return;
  }
  for (const step of steps) if (!validateHotkey(step).valid) throw new Error(`Invalid shortcut: ${step}`);
  const key = steps.map((step) => normalizeHotkey(step)).join(" ");
  const collision = core.keyboard.catalog().find(
    (candidate) =>
      candidate.id !== id &&
      !candidate.disabled &&
      !candidate.binding.layer &&
      getKeybindingSteps(candidate.binding.keybinding)
        .map((step) => normalizeHotkey(step))
        .join(" ") === key,
  );
  if (collision) throw new Error(`Already assigned to ${collision.label}.`);
  if (steps.some((step) => /^(Escape|Enter|ArrowLeft|ArrowRight)$/i.test(step)))
    throw new Error("Use a modifier for a direct navigation shortcut.");
};
