import { createSlotRecipeContext, type HTMLChakraProps, type RecipeVariantProps } from "@chakra-ui/react";
import { segmentedControlSlotRecipe as recipe } from "@/theme/recipes/segmented-control";

const { withProvider, withContext } = createSlotRecipeContext({ recipe });

type VariantProps = RecipeVariantProps<typeof recipe>;

export interface SegmentedControlRootProps extends HTMLChakraProps<"div">, VariantProps {}
const SegmentedControlRoot = withProvider<HTMLDivElement, SegmentedControlRootProps>("div", "root");

export interface SegmentedControlItemProps extends HTMLChakraProps<"button"> {}
const SegmentedControlItem = withContext<HTMLButtonElement, SegmentedControlItemProps>("button", "item");

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps extends Omit<SegmentedControlRootProps, "onChange"> {
  options: SegmentedControlOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export const SegmentedControl = (props: SegmentedControlProps) => {
  const { options, value, onValueChange, disabled, "aria-label": ariaLabel, ...rootProps } = props;

  return (
    <SegmentedControlRoot role="group" aria-label={ariaLabel} {...rootProps}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <SegmentedControlItem
            key={option.value}
            type="button"
            aria-pressed={selected}
            data-selected={selected ? "" : undefined}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </SegmentedControlItem>
        );
      })}
    </SegmentedControlRoot>
  );
};
