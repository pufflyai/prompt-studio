import { Icon as ChakraIcon, Table } from "@chakra-ui/react";
import { Check, Minus } from "lucide-react";
import { Checkbox } from "@/components/primitives/checkbox";

const stopControlPropagation = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

interface EditModeSelectionHeaderProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}

export const EditModeSelectionHeader = (props: EditModeSelectionHeaderProps) => {
  const { checked, indeterminate, onChange } = props;

  return (
    <Checkbox
      checked={checked ? true : indeterminate ? "indeterminate" : false}
      aria-label="Select all"
      icon={<ChakraIcon as={indeterminate ? Minus : Check} boxSize="12px" strokeWidth="3" />}
      onClick={stopControlPropagation}
      onCheckedChange={(details) => onChange(details.checked === true)}
    />
  );
};

interface EditModeSelectionCellProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const EditModeSelectionCell = (props: EditModeSelectionCellProps) => {
  const { checked, onChange } = props;

  return (
    <Table.Cell
      data-column-id="rowSelection"
      height="10"
      padding="xs"
      textAlign="center"
      background="bg"
      borderRightWidth="1px"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Checkbox
        checked={checked}
        aria-label="Select row"
        icon={<ChakraIcon as={Check} boxSize="12px" strokeWidth="3" />}
        onClick={stopControlPropagation}
        onCheckedChange={(details) => onChange(details.checked === true)}
      />
    </Table.Cell>
  );
};
