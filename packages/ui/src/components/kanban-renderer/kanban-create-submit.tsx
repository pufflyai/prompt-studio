import { Button, ButtonGroup, Icon, IconButton, Menu, Portal } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";

interface KanbanCreateSubmitProps {
  label: string;
  withoutOpeningLabel?: string;
  openCreatedRow: boolean;
  onChoose: (openCreatedRow: boolean) => void;
  onSubmit: () => void;
  disabled: boolean;
  submitting: boolean;
}

export function KanbanCreateSubmit(props: KanbanCreateSubmitProps) {
  const { label, withoutOpeningLabel, openCreatedRow, onChoose, onSubmit, disabled, submitting } = props;
  const selectedLabel = !openCreatedRow && withoutOpeningLabel ? withoutOpeningLabel : label;
  return (
    <Menu.Root positioning={{ placement: "top-end" }}>
      <ButtonGroup size="sm" variant="primary" attached>
        <Button disabled={disabled || submitting} loading={submitting} onClick={onSubmit}>
          {selectedLabel}
        </Button>
        {withoutOpeningLabel ? (
          <Menu.Trigger asChild>
            <IconButton aria-label={withoutOpeningLabel} disabled={disabled || submitting}>
              <Icon as={ChevronDown} />
            </IconButton>
          </Menu.Trigger>
        ) : null}
      </ButtonGroup>
      {withoutOpeningLabel ? (
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.RadioItemGroup
                value={openCreatedRow ? "open" : "stay"}
                onValueChange={({ value }) => onChoose(value === "open")}
              >
                <Menu.RadioItem value="open">
                  {label}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
                <Menu.RadioItem value="stay">
                  {withoutOpeningLabel}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              </Menu.RadioItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      ) : null}
    </Menu.Root>
  );
}
