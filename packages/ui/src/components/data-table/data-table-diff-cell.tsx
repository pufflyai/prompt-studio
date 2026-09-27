import { DiffBubble } from "../diff-viewer/diff-bubble";
import type { DataTableDiffValue } from "./types";

export const DataTableDiffCell = (props: { value: DataTableDiffValue }) => {
  const { value } = props;
  return <DiffBubble additions={value.additions} deletions={value.deletions} variant="ghost" size="small" />;
};
