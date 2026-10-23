import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import type { KeyboardActionChoice } from "./keyboard-controller";
import { presentationResourceKey, regionLabel } from "./keyboard-presentations";
import type { ResolvedShortcut } from "./shortcut-catalog";

export const runShortcutMatches = async (
  candidates: ResolvedShortcut[],
  select: (title: string, choices: KeyboardActionChoice[]) => void,
  run: (shortcut: ResolvedShortcut) => Promise<void>,
) => {
  const groups = new Map<string, ResolvedShortcut[]>();
  for (const shortcut of candidates) {
    const key = getNavigationTargetKey(shortcut.binding.action);
    const group = groups.get(key) ?? [];
    group.push(shortcut);
    groups.set(key, group);
  }
  const runGroup = async (group: ResolvedShortcut[]) => {
    const seen = new Set<string>();
    const targets = group
      .flatMap((shortcut) => shortcut.targets.map((target) => ({ shortcut, target })))
      .filter(({ shortcut, target }) => {
        const key =
          shortcut.binding.targetScope === "resource" ? (presentationResourceKey(target) ?? target.id) : target.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (targets.length <= 1) {
      const chosen = targets[0];
      await run(chosen ? { ...chosen.shortcut, targets: [chosen.target] } : group[0]!);
      return;
    }
    select(
      group[0]!.label,
      targets.map(({ shortcut, target }, index) => ({
        key: String(index + 1),
        label: `${target.label} · ${regionLabel(target.region)}`,
        choose: () => run({ ...shortcut, targets: [target] }),
      })),
    );
  };
  if (groups.size === 1) {
    await runGroup([...groups.values()][0]!);
    return;
  }
  select(
    "Choose action",
    [...groups.values()].map((group, index) => ({
      key: String(index + 1),
      label: group[0]!.label,
      choose: () => runGroup(group),
    })),
  );
};
