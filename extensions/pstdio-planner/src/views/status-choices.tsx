import { Box } from "@chakra-ui/react";
import { SelectionInput } from "@pstdio/ui/param-editor";
import type { PlannerStatus } from "../public-command-refs";

interface StatusChoicesProps {
  id: string;
  label: string;
  description: string;
  statuses: PlannerStatus[];
  value: string | string[];
  multiple?: boolean;
  disabled?: boolean;
  onChange: (value: string | string[]) => void;
}

export function StatusChoices(props: StatusChoicesProps) {
  const { id, label, description, statuses, value, multiple, disabled, onChange } = props;
  let selected: string[] = [];
  if (Array.isArray(value)) selected = value;
  else if (value) selected = [value];
  const options = [
    ...statuses.map((status) => ({
      id: status.id,
      name: status.name,
      icon: status.icon ?? "circle",
      color: status.color ?? undefined,
    })),
    ...selected
      .filter((id) => !statuses.some((status) => status.id === id))
      .map((id) => ({ id, name: `Missing status: ${id}` })),
  ];
  return (
    <Box role="group" aria-label={label}>
      <SelectionInput
        id={id}
        name={label}
        description={description}
        options={options}
        defaultValue={value}
        multiSelect={multiple}
        clearable={!multiple}
        disabled={disabled}
        searchable
        fullWidth
        size="sm"
        onChange={(_id, value) => onChange(value)}
      />
    </Box>
  );
}
