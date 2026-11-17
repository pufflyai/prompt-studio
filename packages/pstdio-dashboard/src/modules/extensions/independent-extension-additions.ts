import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { omitExtensionMetadata } from "./extension-contribution-isolation";

const referenceKinds = new Set(["view", "command", "mode", "page", "placement", "resource-kind", "settings-section"]);
const sharedDefinitionGroups = [
  "resourceKinds",
  "menuContributions",
  "commandPaletteContributions",
  "viewMenus",
  "settingsPanels",
  "settingsDefinitions",
  "commandPaletteResources",
] as const;

const metadataOwner = (field: string, row: unknown) => {
  if (!row || typeof row !== "object") return;
  const record = row as { id?: unknown; extensionId?: unknown };
  const id = field === "extensions" ? record.id : record.extensionId;
  return typeof id === "string" ? id : undefined;
};

const referencesOwner = (value: unknown, owners: ReadonlySet<string>) => {
  const pending = [value];
  const prefixes = [...owners];
  while (pending.length) {
    const next = pending.pop();
    if (typeof next === "string" && prefixes.some((owner) => next === owner || next.startsWith(`${owner}.`)))
      return true;
    if (next && typeof next === "object") {
      const reference = next as { kind?: unknown; id?: unknown; extensionId?: unknown };
      if (
        typeof reference.id === "string" &&
        typeof reference.kind === "string" &&
        referenceKinds.has(reference.kind) &&
        typeof reference.extensionId !== "string"
      )
        return true;
      pending.push(...Object.values(next));
    }
  }
  return false;
};

const keepsInstalledDefinitions = (
  current: ResolvedWorkbenchExtensionMetadata,
  next: ResolvedWorkbenchExtensionMetadata,
  installed: ReadonlySet<string>,
  added: ReadonlySet<string>,
) => {
  for (const field of new Set([...Object.keys(current), ...Object.keys(next)])) {
    if (field === "diagnostics") continue;
    const before = current[field as keyof typeof current] ?? [];
    const after = next[field as keyof typeof next] ?? [];
    if (!Array.isArray(before) || !Array.isArray(after)) return false;
    const owner = (row: unknown) => metadataOwner(field, row);
    // An unowned declaration may derive behavior across the complete catalog.
    if ([...before, ...after].some((row) => !owner(row))) return false;
    const retained = after.filter((row) => installed.has(owner(row)!));
    if (JSON.stringify(before) !== JSON.stringify(retained)) return false;
    if (before.some((row) => referencesOwner(row, added))) return false;
    if (after.filter((row) => added.has(owner(row)!)).some((row) => referencesOwner(row, installed))) return false;
  }
  return true;
};

/** Independent additions cannot change the installed cohort's resolved references or derived definitions. */
export const independentExtensionAdditions = (
  current: ResolvedWorkbenchExtensionMetadata,
  next: ResolvedWorkbenchExtensionMetadata,
) => {
  const installed = new Set(current.extensions.map((extension) => extension.id));
  if (!installed.size) return;
  const added = new Set(next.extensions.map((extension) => extension.id).filter((id) => !installed.has(id)));
  if (!added.size) return;
  const appendedBindings = [
    ...(current.keybindings ?? []),
    ...(next.keybindings ?? []).filter((binding) => added.has(binding.extensionId)),
  ];
  if (JSON.stringify(next.keybindings ?? []) !== JSON.stringify(appendedBindings)) return;
  // Native sources can return foreign resources/actions that need the complete runtime catalog.
  if (next.views.some((view) => added.has(view.extensionId) && view.body.kind !== "webview")) return;
  // These declarations derive global lookup, ordering or shared-name precedence.
  if (sharedDefinitionGroups.some((field) => JSON.stringify(current[field]) !== JSON.stringify(next[field]))) return;
  if (!keepsInstalledDefinitions(current, next, installed, added)) return;
  return { added, metadata: omitExtensionMetadata(next, installed) };
};
