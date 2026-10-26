import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import type { WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { collectionMainOwner } from "./collection-main-owner";

interface CollectionMainMigrationInput {
  context: WorkbenchPagePersistenceScopeInput;
  page: WorkbenchPageContribution;
  pages: readonly WorkbenchPageContribution[];
  scope: string;
  preferredScope: string;
  layouts: readonly { scope?: string; layout: WorkbenchLayout }[];
  read(scope: string): WorkbenchLayout | undefined;
  write(layout: WorkbenchLayout, scope: string): boolean | undefined;
  clear(scope: string, fallback: WorkbenchLayout): void;
}

export const migrateCollectionMain = (input: CollectionMainMigrationInput) => {
  const prefix = "workbench-main:";
  const preferred = input.read(input.preferredScope);
  const candidates = new Map(input.layouts.map((entry) => [entry.scope, entry]));
  if (preferred) candidates.set(input.preferredScope, { scope: input.preferredScope, layout: preferred });
  const sources = [...candidates.values()].filter(({ scope, layout }) => {
    if (!scope?.startsWith(prefix) || layout.regions.main.widgets.length === 0) return false;
    const [projectId, modeId, pageId] = JSON.parse(scope.slice(prefix.length));
    const page = input.pages.find((candidate) => candidate.id === pageId);
    return (
      projectId === input.context.projectId &&
      modeId === input.context.modeId &&
      collectionMainOwner(page, input.pages)?.id === input.page.id
    );
  });
  if (!sources.length) return;
  if (!input.read(input.scope)) {
    const selected = sources.find((source) => source.scope === input.preferredScope) ?? sources.at(-1)!;
    const ordered = [selected, ...sources.filter((source) => source !== selected)];
    const seen = new Set<string>();
    const widgets = ordered
      .flatMap(({ layout }) => layout.regions.main.widgets)
      .filter((tab) => {
        if (seen.has(tab.widgetId)) return false;
        seen.add(tab.widgetId);
        return true;
      });
    const layout = {
      ...selected.layout,
      regions: { ...selected.layout.regions, main: { ...selected.layout.regions.main, widgets } },
    };
    if (!input.write(layout, input.scope)) return;
  }
  // Consume the separate trays even when an empty collection snapshot wins.
  // Closing its last tab must never bring an old detail cache back.
  for (const { scope, layout } of sources) {
    input.clear(scope!, {
      ...layout,
      regions: { ...layout.regions, main: { ...layout.regions.main, widgets: [], activeWidgetId: undefined } },
      activeWidgetId: undefined,
      activeLocationWidgetId: undefined,
      activeResourceKey: undefined,
    });
  }
};
