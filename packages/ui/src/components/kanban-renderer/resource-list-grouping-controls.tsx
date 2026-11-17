import { Button, Text } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { DisplayMenuSelect } from "./display-menu-select";
import type { MenuOption } from "./kanban-renderer-helpers";
import { NO_GROUPING } from "./types";

interface ResourceListGroupingControlsProps {
  settings: { columnGrouping: string; subGroupings?: string[] };
  /** Groupable fields, with "none" first. */
  groupingOptions: MenuOption[];
  onSubGroupingsChange: (subGroupings: string[]) => void;
}

export const subGroupingLabel = (level: number) => (level === 0 ? "Sub-grouping" : `Sub-grouping ${level + 1}`);

/** Fields a level may use: none of the grouping or other levels' fields. */
const optionsForLevel = (props: ResourceListGroupingControlsProps, level: number) => {
  const levels = props.settings.subGroupings ?? [];
  const taken = new Set([props.settings.columnGrouping, ...levels.filter((_, index) => index !== level)]);
  return props.groupingOptions.filter((option) => option.value === NO_GROUPING || !taken.has(option.value));
};

/**
 * One select per sub-grouping level, then "Add sub-grouping" while unused groupable fields remain.
 * Choosing None for a level removes it and every deeper level.
 */
export const ResourceListGroupingControls = (props: ResourceListGroupingControlsProps) => {
  const { settings, onSubGroupingsChange } = props;
  if (settings.columnGrouping === NO_GROUPING) return null;
  const levels = settings.subGroupings ?? [];
  const next = optionsForLevel(props, levels.length).find((option) => option.value !== NO_GROUPING);

  return (
    <>
      {levels.map((field, level) => (
        <DisplayMenuSelect
          key={`${level}-${field}`}
          label={subGroupingLabel(level)}
          value={field}
          options={optionsForLevel(props, level)}
          onSelect={(value) =>
            onSubGroupingsChange(
              value === NO_GROUPING
                ? levels.slice(0, level)
                : levels.map((current, index) => (index === level ? value : current)),
            )
          }
        />
      ))}
      {next ? (
        <Button
          size="xs"
          variant="ghost"
          width="full"
          justifyContent="flex-start"
          gap="xs"
          color="fg.muted"
          onClick={() => onSubGroupingsChange([...levels, next.value])}
        >
          <Plus size={12} />
          <Text textStyle="label/S/regular">Add {subGroupingLabel(levels.length).toLowerCase()}</Text>
        </Button>
      ) : null}
    </>
  );
};
