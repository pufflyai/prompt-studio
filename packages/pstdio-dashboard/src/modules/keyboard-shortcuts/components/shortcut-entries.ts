import { contributionRefId, isLocalizedString } from "@pstdio/sdk/extensions";
import {
  getNavigationTargetKey,
  type KeybindingSequence,
  type NavigationTarget,
  type WorkbenchCore,
} from "@pstdio/workbench";

export interface ShortcutEntry {
  id: string;
  label: string;
  category: string;
  keybindings: KeybindingSequence[];
}

const commandOwner = (commandId: string, fallback: string) =>
  commandId.split(".command.")[0] === commandId ? fallback : commandId.split(".command.")[0]!;

const actionOwner = (action: NavigationTarget, fallback: string): string => {
  if (action.kind === "command") return commandOwner(action.commandId, fallback);
  if (action.kind === "page") return action.page.extensionId ?? fallback;
  if (action.kind === "panel") {
    if (action.panel.kind === "page-slot") return action.panel.page.extensionId ?? fallback;
    return action.panel.kind === "placement" ? (action.panel.extensionId ?? fallback) : fallback;
  }
  if (action.kind === "compound")
    return [...new Set(action.targets.map((target) => actionOwner(target, fallback)))].join(" + ");
  return fallback;
};

interface ShortcutExtension {
  id: string;
  name: string;
  displayName?: string;
}

export const readShortcutSources = (workbench: WorkbenchCore, extensions: ShortcutExtension[] = []) => ({
  extensions,
  commands: workbench.commands.store.getState().commands,
  keybindings: workbench.keybindings.store.getState().keybindings,
  menus: workbench.layout.menuStore.getState().itemsByPath,
  pages: workbench.pages.store.getState().pages,
  views: workbench.views.store.getState().views,
  widgets: workbench.layout.store.getState().widgets,
  navigationActions: workbench.navigationTrees.listActions(),
  modePlacements: workbench.modePlacements.listPlacements(),
});
type ShortcutSources = ReturnType<typeof readShortcutSources>;

const actionLabel = (sources: ShortcutSources, action: NavigationTarget): string => {
  if (action.kind === "command") return sources.commands[action.commandId]?.command.label ?? "Command";
  if (action.kind === "href") return action.href;
  if (action.kind === "compound") return action.targets.map((target) => actionLabel(sources, target)).join(" + ");
  if (action.kind === "page") {
    const page = sources.pages[contributionRefId(action.page)];
    const title = page?.title;
    return (isLocalizedString(title) ? (title.default ?? title.$l10n) : title) ?? action.page.id;
  }
  const panel = action.panel;
  if (panel.kind === "shell-placement") return sources.widgets[panel.id]?.title ?? panel.id;
  // Panel refs name an owned page or mode slot, rather than a view id.
  const slot =
    panel.kind === "page-slot"
      ? sources.pages[contributionRefId(panel.page)]?.slots.find((slot) => slot.id === panel.id)
      : sources.modePlacements.find((placement) => contributionRefId(placement.ref) === contributionRefId(panel));
  if (!slot) return panel.id;
  const view = slot.item.kind === "view" ? slot.item.view : slot.item.binding.view;
  return sources.views[contributionRefId(view)]?.title ?? panel.id;
};

const userFacingActions = (sources: ShortcutSources) => {
  const menus = Object.values(sources.menus)
    .flat()
    .flatMap((menu) => {
      const commandId = menu.sourceCommandId ?? menu.commandId;
      const record = sources.commands[commandId];
      return record
        ? [
            {
              action: { kind: "command" as const, commandId, args: menu.args },
              label: menu.label || record.command.label,
              ownerId: menu.ownerId,
              category: record.command.category,
            },
          ]
        : [];
    });
  const navigation = sources.navigationActions.map((placement) => {
    const destinations = actionLabel(sources, placement.action);
    const label =
      placement.action.kind === "compound" && placement.label !== destinations
        ? `${placement.label}: ${destinations}`
        : placement.label;
    return { ...placement, label };
  });
  const toolbar = Object.values(sources.views).flatMap((view) => {
    if (view.body.kind !== "dataTable" && view.body.kind !== "kanban") return [];
    const actions = [
      ...(view.body.toolbarActions ?? []),
      ...(view.body.kind === "kanban"
        ? (view.body.listRowActions?.() ?? [])
        : [...(view.body.rowActions ?? []), ...(view.body.selectionActions ?? [])]),
    ];
    return actions.flatMap((action) => {
      const record = action.commandId ? sources.commands[action.commandId] : undefined;
      return record
        ? [
            {
              action: {
                kind: "command" as const,
                commandId: record.command.id,
                args: "args" in action ? action.args : undefined,
              },
              label: action.label || record.command.label,
              ownerId: view.ownerId,
              category: record.command.category,
            },
          ]
        : [];
    });
  });
  return [...menus, ...navigation, ...toolbar];
};

export const buildShortcutEntries = (sources: ShortcutSources) => {
  const entries = new Map<string, ShortcutEntry>();
  const add = (action: NavigationTarget, label: string, owner: string, category?: string) => {
    const id = getNavigationTargetKey(action);
    let entry = entries.get(id);
    if (!entry) {
      const extension = actionOwner(action, owner);
      let group = category ?? "Workbench";
      if (extension === "pstdio") group = "Dashboard";
      else if (extension !== "workbench.core" && !extension.startsWith("dashboard.")) {
        group = extension
          .split(" + ")
          .map((id) => {
            const metadata = sources.extensions.find((candidate) => candidate.id === id);
            return metadata?.displayName || metadata?.name || "Extensions";
          })
          .join(" + ");
      }
      entry = { id, label, category: group, keybindings: [] };
      entries.set(id, entry);
    }
    return entry;
  };
  for (const action of userFacingActions(sources)) add(action.action, action.label, action.ownerId, action.category);
  for (const binding of sources.keybindings) {
    const record = binding.action.kind === "command" ? sources.commands[binding.action.commandId] : undefined;
    const entry = add(
      binding.action,
      actionLabel(sources, binding.action),
      binding.sourceExtensionId ?? binding.ownerId,
      record?.command.category,
    );
    const chord = JSON.stringify(binding.keybinding);
    if (!entry.keybindings.some((existing) => JSON.stringify(existing) === chord))
      entry.keybindings.push(binding.keybinding);
  }
  return [...entries.values()]
    .filter((entry) => entry.keybindings.length > 0)
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
};
