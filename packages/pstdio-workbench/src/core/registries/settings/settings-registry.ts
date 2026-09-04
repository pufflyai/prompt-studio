import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

/** Settings are stored either per-user (global) or per-project. Projectless surfaces show only global entries. */
export type SettingsScope = "global" | "project";

/** A "+ create"-style action surfaced on a section or a collection's parent node. */
export interface SettingsAction {
  id: string;
  label: string;
  icon?: string;
  run(): void | Promise<void>;
}

/** An ordered sidenav container. Headerless when `title` is omitted. */
export interface SettingsSectionContribution {
  id: string;
  title?: string;
  order?: number;
  scope?: SettingsScope;
  actions?: SettingsAction[];
}
export type RegisteredSettingsSection = SettingsSectionContribution & RegisteredContributionMetadata;

/** A preference this panel edits; a bare string uses the preference name as its label. */
export type SettingsPanelPreference = string | { name: string; label?: string };

export interface SettingsPanelBase {
  id: string;
  title: string;
  description?: string;
  /** Section id this panel belongs to. */
  section?: string;
  icon?: string;
  /** Lower sorts first; ties fall back to contribution priority then registration order. */
  order?: number;
  scope?: SettingsScope;
  when?: string;
}

/** Auto-rendered as a param editor from the registered preference schema. */
export interface SchemaSettingsPanel extends SettingsPanelBase {
  kind: "schema";
  preferences: SettingsPanelPreference[];
  /** "live" persists on change (default); "apply" stages edits behind Save/Discard. */
  save?: "live" | "apply";
}

export interface ViewSettingsPanel extends SettingsPanelBase {
  kind: "view";
  viewId: string;
}

export interface SettingsCollectionGroupBy<TItem> {
  key(item: TItem): string;
  order?: string[];
  label(key: string): string;
  icon?(key: string): string | undefined;
}

/**
 * A data-driven list of items, each opening a contributor-supplied editor. The
 * framework knows nothing about what an item is — it only calls these hooks.
 */
export interface CollectionSettingsPanel<TItem = unknown> extends SettingsPanelBase {
  kind: "collection";
  viewId: string;
  items(): TItem[] | Promise<TItem[]>;
  itemId(item: TItem): string;
  itemLabel(item: TItem): string;
  itemIcon?(item: TItem): string | undefined;
  groupBy?: SettingsCollectionGroupBy<TItem>;
  actions?: SettingsAction[];
}

export type SettingsPanelContribution = SchemaSettingsPanel | ViewSettingsPanel | CollectionSettingsPanel;
export type RegisteredSettingsPanel = SettingsPanelContribution & RegisteredContributionMetadata;

export interface SettingsRegistryStoreState {
  sections: Record<string, RegisteredSettingsSection>;
  panels: Record<string, RegisteredSettingsPanel>;
  /** Bumped by refresh() so the surface re-reads collection items() after backing data changes. */
  revision: number;
}

export interface SettingsRegistry {
  store: WorkbenchStore<SettingsRegistryStoreState>;
  registerSection(section: SettingsSectionContribution, metadata?: ContributionMetadata): Disposable;
  registerPanel<TItem = unknown>(
    panel: SchemaSettingsPanel | ViewSettingsPanel | CollectionSettingsPanel<TItem>,
    metadata?: ContributionMetadata,
  ): Disposable;
  getSection(id: string): RegisteredSettingsSection | undefined;
  getPanel(id: string): RegisteredSettingsPanel | undefined;
  listSections(): RegisteredSettingsSection[];
  listPanels(): RegisteredSettingsPanel[];
  resolveCollectionItem(panelId: string, itemId: string): Promise<unknown | undefined>;
  getCollectionItem(panelId: string, itemId: string): unknown | undefined;
  /** Signal that a collection's backing data changed so the surface refreshes. */
  refresh(): void;
}

const byOrderThenPriority = <T extends RegisteredContributionMetadata & { order?: number }>(left: T, right: T) =>
  (left.order ?? 0) - (right.order ?? 0) || byContributionPriority(left, right);

export const createSettingsRegistry = (input: { hasView?: (viewId: string) => boolean } = {}): SettingsRegistry => {
  const store = createWorkbenchStore<SettingsRegistryStoreState>({
    name: "workbench.settings",
    initialState: { sections: {}, panels: {}, revision: 0 },
  });
  const collectionItems = new Map<string, unknown>();
  const itemKey = (panelId: string, itemId: string) => JSON.stringify([panelId, itemId]);

  return {
    store,

    refresh() {
      collectionItems.clear();
      const snapshot = store.getState();
      store.setState({ ...snapshot, revision: snapshot.revision + 1 }, false, "refreshSettings");
    },

    registerSection(section, metadata) {
      const snapshot = store.getState();
      if (snapshot.sections[section.id]) throw new Error(`Settings section already registered: ${section.id}`);

      const record = { ...normalizeContributionMetadata(metadata), ...section } as RegisteredSettingsSection;
      store.setState(
        { ...snapshot, sections: { ...snapshot.sections, [section.id]: record } },
        false,
        "registerSection",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.sections[section.id] !== record) return;
        const { [section.id]: _removed, ...nextSections } = current.sections;
        store.setState({ ...current, sections: nextSections }, false, "unregisterSection");
      });
    },

    registerPanel(panel, metadata) {
      const snapshot = store.getState();
      if (snapshot.panels[panel.id]) throw new Error(`Settings panel already registered: ${panel.id}`);
      if (panel.kind !== "schema" && input.hasView && !input.hasView(panel.viewId)) {
        throw new Error(`Settings panel View is not registered: ${panel.viewId}`);
      }

      const record = { ...normalizeContributionMetadata(metadata), ...panel } as RegisteredSettingsPanel;
      store.setState({ ...snapshot, panels: { ...snapshot.panels, [panel.id]: record } }, false, "registerPanel");

      return createDisposable(() => {
        const current = store.getState();
        if (current.panels[panel.id] !== record) return;
        const { [panel.id]: _removed, ...nextPanels } = current.panels;
        for (const key of collectionItems.keys()) {
          if (key.startsWith(`["${panel.id}",`)) collectionItems.delete(key);
        }
        store.setState({ ...current, panels: nextPanels }, false, "unregisterPanel");
      });
    },

    getSection(id) {
      return store.getState().sections[id];
    },

    getPanel(id) {
      return store.getState().panels[id];
    },

    listSections() {
      return Object.values(store.getState().sections).sort(byOrderThenPriority);
    },

    listPanels() {
      return Object.values(store.getState().panels).sort(byOrderThenPriority);
    },

    async resolveCollectionItem(panelId, itemId) {
      const panel = store.getState().panels[panelId];
      if (!panel || panel.kind !== "collection") return undefined;
      const item = (await panel.items()).find((candidate) => panel.itemId(candidate) === itemId);
      if (item !== undefined) collectionItems.set(itemKey(panelId, itemId), item);
      return item;
    },

    getCollectionItem: (panelId, itemId) => collectionItems.get(itemKey(panelId, itemId)),
  };
};
