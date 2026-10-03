import type { PGlite } from "@electric-sql/pglite";
import { viewFilterFromLegacyFilters, viewSortsFromLegacyOrdering } from "pstdio-api-contracts";
import type { KanbanRendererFilterState, KanbanRendererSettings } from "pstdio-api-contracts/extension-kernel";

// Convert values before the generated migration renames the column. Keeping the
// original column until then makes a failed startup safe to retry.
export const prepareBoardViewRules = async (db: PGlite) => {
  const shape = await db.query<{ legacy: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'board_views' AND column_name = 'filters'
  ) AS legacy`);
  if (!shape.rows[0]?.legacy) return;
  await db.transaction(async (tx) => {
    const views = await tx.query<{ id: string; filters: KanbanRendererFilterState }>(
      "SELECT id, filters FROM board_views",
    );
    for (const view of views.rows) {
      if (typeof view.filters.conjunction === "string") continue;
      await tx.query("UPDATE board_views SET filters = $1 WHERE id = $2", [
        viewFilterFromLegacyFilters(view.filters),
        view.id,
      ]);
    }
  });
};

// The old ordering remains in settings across schema migration. Convert and
// remove it together after sorts exists, so an interrupted upgrade loses no order.
export const finishBoardViewRules = async (db: PGlite) => {
  await db.transaction(async (tx) => {
    const views = await tx.query<{ id: string; settings: KanbanRendererSettings }>(
      "SELECT id, settings FROM board_views WHERE settings ? 'ordering'",
    );
    for (const view of views.rows) {
      const { ordering, ...settings } = view.settings;
      await tx.query("UPDATE board_views SET settings = $1, sorts = $2 WHERE id = $3", [
        settings,
        viewSortsFromLegacyOrdering(ordering),
        view.id,
      ]);
    }
  });
};
