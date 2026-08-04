import type {
  CollectionSettingsPanel,
  RegisteredSettingsPanel,
  SettingsAction,
  SettingsRegistry,
  TreeAction,
  TreeNode,
  TreeViewSection,
} from "../../core";
import { isSettingsScopeVisible, settingsItemResource, settingsPanelResource } from "./settings-resources";

export const FALLBACK_SECTION_ID = "settings";

const toTreeActions = (actions: SettingsAction[] | undefined): TreeAction[] | undefined =>
  actions?.map((action) => ({ id: action.id, label: action.label, icon: action.icon, run: action.run }));

const collectionItemNode = (panel: CollectionSettingsPanel, item: unknown): TreeNode => {
  const id = panel.itemId(item);
  const label = panel.itemLabel(item);
  const icon = panel.itemIcon?.(item);
  const resource = settingsItemResource(panel.id, { id, label, icon });
  return { id: resource.uri, label, icon, resource };
};

const orderGroupKeys = (keys: string[], order: string[] | undefined) => {
  const indexOf = (key: string) => {
    const index = order?.indexOf(key) ?? -1;
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  return [...keys].sort((left, right) => indexOf(left) - indexOf(right));
};

const collectionChildren = async (panel: CollectionSettingsPanel): Promise<TreeNode[]> => {
  const items = await Promise.resolve(panel.items()).catch(() => []);
  if (!panel.groupBy) return items.map((item) => collectionItemNode(panel, item));

  const groupBy = panel.groupBy;
  const byKey = new Map<string, unknown[]>();
  for (const item of items) {
    const key = groupBy.key(item);
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }

  return orderGroupKeys([...byKey.keys()], groupBy.order).map((key) => ({
    id: `${panel.id}:group:${key}`,
    label: groupBy.label(key),
    icon: groupBy.icon?.(key),
    collapsible: true,
    children: (byKey.get(key) ?? []).map((item) => collectionItemNode(panel, item)),
  }));
};

const panelToNode = async (panel: RegisteredSettingsPanel): Promise<TreeNode> => {
  if (panel.kind === "collection") {
    return {
      id: `settings-collection:${panel.id}`,
      label: panel.title,
      icon: panel.icon,
      collapsible: true,
      actions: toTreeActions(panel.actions),
      children: await collectionChildren(panel),
    };
  }

  const resource = settingsPanelResource(panel);
  return { id: resource.uri, label: panel.title, icon: panel.icon, resource };
};

export interface BuildSettingsTreeInput {
  settings: SettingsRegistry;
  hasProjectScope: boolean;
}

// Derives the settings navigation tree from the registry: one section per registered
// section (headerless when titleless), schema/custom panels as leaves, and collection
// panels expanded into per-item nodes (optionally grouped). Scope gates project entries.
export const buildSettingsTreeBody = async (input: BuildSettingsTreeInput): Promise<TreeViewSection[]> => {
  const { settings, hasProjectScope } = input;
  const sections = settings.listSections();
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const panels = settings.listPanels().filter((panel) => isSettingsScopeVisible(panel.scope, hasProjectScope));

  const bySection = new Map<string, RegisteredSettingsPanel[]>();
  for (const panel of panels) {
    const sectionId = panel.section && sectionsById.has(panel.section) ? panel.section : FALLBACK_SECTION_ID;
    const list = bySection.get(sectionId) ?? [];
    list.push(panel);
    bySection.set(sectionId, list);
  }

  const renderOrder = sections.map((section) => section.id);
  if (bySection.has(FALLBACK_SECTION_ID) && !sectionsById.has(FALLBACK_SECTION_ID)) {
    renderOrder.push(FALLBACK_SECTION_ID);
  }

  const result: TreeViewSection[] = [];
  for (const sectionId of renderOrder) {
    const section = sectionsById.get(sectionId);
    // Sections are containers — only hide one that is *explicitly* project-scoped.
    // No-scope sections fall through and are dropped below if they have no content.
    if (section?.scope === "project" && !hasProjectScope) continue;

    const sectionPanels = bySection.get(sectionId) ?? [];
    const actions = toTreeActions(section?.actions);
    if (sectionPanels.length === 0 && !actions) continue;

    const nodes: TreeNode[] = [];
    for (const panel of sectionPanels) nodes.push(await panelToNode(panel));
    // Settings groups are plain labels, not accordions — the whole tree stays visible.
    result.push({ id: sectionId, label: section?.title, actions, nodes, collapsible: false });
  }

  return result;
};
