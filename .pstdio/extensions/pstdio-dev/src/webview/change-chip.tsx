import { Chip } from "@pstdio/ui";
import type { Change } from "../benchmarks/analysis";
import type { BenchmarkUnit } from "../benchmarks/result-file";
import { verdictPalette, verdictText } from "./format";

interface ChangeChipProps {
  change?: Change | null;
  unit: BenchmarkUnit;
  emptyLabel?: string;
}

export const ChangeChip = (props: ChangeChipProps) => {
  const { change, unit, emptyLabel = "First result" } = props;
  if (!change) return <Chip colorPalette="gray">{emptyLabel}</Chip>;
  return <Chip colorPalette={verdictPalette[change.verdict]}>{verdictText(change, unit)}</Chip>;
};
