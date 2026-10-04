import { HighlightedText } from "../collection-view/highlighted-text";
import { DiffBubble } from "../diff-viewer/diff-bubble";
import type { DataTableDiffValue } from "./types";

export const DataTableDiffCell = (props: { value: DataTableDiffValue; search?: string }) => {
  const { value, search = "" } = props;
  return (
    <DiffBubble
      additions={value.additions}
      deletions={value.deletions}
      variant="ghost"
      size="small"
      additionsLabel={<HighlightedText text={`+${value.additions}`} query={search} />}
      deletionsLabel={<HighlightedText text={`-${value.deletions}`} query={search} />}
    />
  );
};
