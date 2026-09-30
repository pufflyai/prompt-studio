import { resolveVisibility, type TreeListSection, type VisibilityOverride } from "@pstdio/ui";

// A section left empty because users moved its rows elsewhere stays as an empty drop target, so the rows can move
// back. Sections users hid, sections their contributor sent empty, and outer-level sections whose rows are all
// pinned-only stay out.
export const keepSectionsEmptiedByMoves = (
  source: TreeListSection[],
  ordered: TreeListSection[],
  visible: TreeListSection[],
  sectionOverrides: Record<string, VisibilityOverride>,
  pinnedOnlyNodeIds: ReadonlySet<string> = new Set(),
) => {
  const visibleById = new Map(visible.map((section) => [section.id, section]));
  const hadRows = new Set(
    source
      .filter((section) => section.nodes.some((node) => !pinnedOnlyNodeIds.has(node.id)))
      .map((section) => section.id),
  );
  return ordered.flatMap((section) => {
    const shown = visibleById.get(section.id);
    if (shown) return [shown];
    const emptiedByMoves =
      section.nodes.length === 0 &&
      hadRows.has(section.id) &&
      resolveVisibility(sectionOverrides[section.id], section.hiddenByDefault) === "shown";
    return emptiedByMoves ? [section] : [];
  });
};
