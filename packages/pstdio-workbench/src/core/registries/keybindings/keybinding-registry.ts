import type { ContextKeyService } from "../../shared/context/context-key-service";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { CommandRegistry } from "../commands/command-registry";
import type { NavigationTarget } from "../navigation/navigation-registry";
import { getNavigationTargetKey } from "../navigation/navigation-target-key";
import type { PreferenceRegistry } from "../preferences/preference-registry";
import { readShortcutPreferences, type ShortcutLayer, sharedShortcutLayer } from "./shortcut-preferences";

export interface Keybinding {
  id?: string;
  label?: string;
  layer?: ShortcutLayer;
  targetScope?: "project" | "resource" | "panel";
  sticky?: boolean;
  /** Extension that authored this binding, when registered by an extension host. */
  sourceExtensionId?: string;
  sourceExtensionLabel?: string;
  /** Action the chord executes through the shared navigation executor. */
  action: NavigationTarget;
  keybinding: KeybindingSequence;
  /** Explicit workbench chord, including editors, terminals, and managed webviews. */
  allowInInputs?: boolean;
  when?: string;
}

export type KeybindingSequence = string | string[];

export interface RegisteredKeybinding extends Keybinding, RegisteredContributionMetadata {}

interface KeybindingRegistryDeps {
  commands: CommandRegistry;
  context: ContextKeyService;
  preferences?: () => PreferenceRegistry;
  actions?: () => {
    label: string;
    action: NavigationTarget;
    ownerId: string;
    source?: ContributionMetadata["source"];
    aliasCommandId?: string;
  }[];
}

export interface KeybindingRegistryStoreState {
  keybindings: RegisteredKeybinding[];
}

export interface KeybindingRegistry {
  store: WorkbenchStore<KeybindingRegistryStoreState>;
  registerKeybinding(keybinding: Keybinding, metadata?: ContributionMetadata): Disposable;
  listKeybindings(): RegisteredKeybinding[];
  listCatalog(): RegisteredKeybinding[];
  resolve(binding: RegisteredKeybinding): RegisteredKeybinding & { disabled: boolean };
  getId(binding: Keybinding): string;
  listActiveKeybindings(): RegisteredKeybinding[];
  /** Chords bound to plain command actions, for rendering shortcut hints beside commands. */
  listCommandKeybindings(): { commandId: string; keybinding: KeybindingSequence }[];
}

export const getKeybindingSteps = (keybinding: KeybindingSequence) => {
  if (Array.isArray(keybinding)) return keybinding;

  return keybinding.trim().split(/\s+/).filter(Boolean);
};

const normalizeKeybindingSequence = (keybinding: KeybindingSequence): KeybindingSequence => {
  const steps = getKeybindingSteps(keybinding);
  return steps.length === 1 ? (steps[0] ?? "") : steps;
};

export const createKeybindingRegistry = (deps: KeybindingRegistryDeps): KeybindingRegistry => {
  const store = createWorkbenchStore<KeybindingRegistryStoreState>({
    name: "workbench.keybindings",
    initialState: { keybindings: [] },
  });

  const getId = (binding: Keybinding) =>
    binding.id ??
    `${binding.sourceExtensionId ?? "workbench"}:${binding.layer ?? "direct"}:${getNavigationTargetKey(binding.action)}`;
  const resolve = (binding: RegisteredKeybinding) => {
    const override = readShortcutPreferences(deps.preferences?.()).overrides[getId(binding)];
    const assigned = override?.layer === "direct" ? undefined : (override?.layer ?? binding.layer);
    const layer = assigned ? sharedShortcutLayer(assigned) : undefined;
    let defaultScope: Keybinding["targetScope"];
    if (assigned === "extensions") defaultScope = "project";
    else if (layer === "current") defaultScope = "panel";
    return {
      ...binding,
      id: getId(binding),
      targetScope: binding.targetScope ?? defaultScope,
      keybinding: override?.keybinding ?? binding.keybinding,
      layer,
      disabled: override?.disabled === true,
    };
  };
  const listCatalog = () => {
    const actions = deps.actions?.() ?? [];
    const aliases = new Set(actions.flatMap((action) => (action.aliasCommandId ? [action.aliasCommandId] : [])));
    const bindings = [...store.getState().keybindings].sort(byContributionPriority);
    const bound = new Set(
      bindings.flatMap((binding) => (binding.action.kind === "command" ? [binding.action.commandId] : [])),
    );
    const records: RegisteredKeybinding[] = [
      ...bindings,
      ...deps.commands
        .listCommands()
        .filter((record) => !bound.has(record.command.id) && !aliases.has(record.command.id))
        .map((record) => ({
          ...record,
          id: record.command.id,
          action: { kind: "command" as const, commandId: record.command.id },
          keybinding: "",
          label: record.command.label,
          sourceExtensionId: record.source === "extension" ? record.ownerId : undefined,
        })),
    ];
    const seen = new Set(records.map((binding) => getNavigationTargetKey(binding.action)));
    for (const action of actions) {
      const key = getNavigationTargetKey(action.action);
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        ...normalizeContributionMetadata({ ownerId: action.ownerId, source: action.source }),
        ...action,
        sourceExtensionId: action.source === "extension" ? action.ownerId : undefined,
        id: `action:${key}`,
        keybinding: "",
      });
    }
    return records;
  };

  return {
    store,
    getId,
    resolve,
    listCatalog,

    registerKeybinding(keybinding, metadata) {
      if (keybinding.action.kind === "command" && !deps.commands.getCommand(keybinding.action.commandId)) {
        throw new Error(`Keybinding command not registered: ${keybinding.action.commandId}`);
      }

      const record: RegisteredKeybinding = {
        ...normalizeContributionMetadata(metadata),
        ...keybinding,
        keybinding: normalizeKeybindingSequence(keybinding.keybinding),
      };

      const snapshot = store.getState();
      store.setState({ keybindings: [...snapshot.keybindings, record] }, false, "registerKeybinding");

      return createDisposable(() => {
        const current = store.getState();
        const next = current.keybindings.filter((candidate) => candidate !== record);
        if (next.length === current.keybindings.length) return;
        store.setState({ keybindings: next }, false, "unregisterKeybinding");
      });
    },

    listKeybindings() {
      return [...store.getState().keybindings].sort(byContributionPriority);
    },

    listActiveKeybindings() {
      return listCatalog()
        .map(resolve)
        .filter(
          (binding) =>
            !binding.disabled &&
            !binding.layer &&
            getKeybindingSteps(binding.keybinding).length > 0 &&
            ((binding.targetScope && binding.targetScope !== "project") || deps.context.matches(binding.when)),
        );
    },

    listCommandKeybindings() {
      return [...store.getState().keybindings]
        .sort(byContributionPriority)
        .map(resolve)
        .filter((record) => !record.layer && !record.disabled)
        .flatMap((record) =>
          record.action.kind === "command"
            ? [{ commandId: record.action.commandId, keybinding: record.keybinding }]
            : [],
        );
    },
  };
};
