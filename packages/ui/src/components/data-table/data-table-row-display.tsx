import { Box, Icon, IconButton, Popover, Portal, Text } from "@chakra-ui/react";
import { Settings2 } from "lucide-react";
import { Switch } from "@/components/primitives/switch";

interface DataTableRowDisplaySwitchProps {
  showDivider?: boolean;
  wrapRows: boolean;
  onWrapRowsChange: (wrapRows: boolean) => void;
}

export const DataTableRowDisplaySwitch = (props: DataTableRowDisplaySwitchProps) => {
  const { showDivider = false, wrapRows, onWrapRowsChange } = props;

  return (
    <Box borderBottomWidth={showDivider ? "1px" : undefined} borderColor="border.subtle" padding="xs">
      <Switch
        checked={wrapRows}
        inputProps={{ role: "switch" }}
        width="full"
        flexDirection="row-reverse"
        justifyContent="space-between"
        onCheckedChange={(details) => onWrapRowsChange(details.checked === true)}
      >
        <Text as="span" textStyle="label/S/regular">
          Wrap rows
        </Text>
      </Switch>
    </Box>
  );
};

interface DataTableRowDisplayMenuProps extends DataTableRowDisplaySwitchProps {
  compact?: boolean;
}

export const DataTableRowDisplayMenu = (props: DataTableRowDisplayMenuProps) => {
  const { compact = false, wrapRows, onWrapRowsChange } = props;
  const content = (
    <Popover.Positioner>
      <Popover.Content width="min(240px, calc(100vw - 32px))" p="0" bg="bg" overflow="hidden">
        <DataTableRowDisplaySwitch wrapRows={wrapRows} onWrapRowsChange={onWrapRowsChange} />
      </Popover.Content>
    </Popover.Positioner>
  );

  return (
    <Popover.Root positioning={{ placement: compact ? "bottom-start" : "bottom-end", offset: { mainAxis: 8 } }}>
      <Popover.Trigger asChild>
        <IconButton aria-label="Display settings" variant="ghost" size={compact ? "2xs" : "sm"}>
          <Icon as={Settings2} boxSize="14px" />
        </IconButton>
      </Popover.Trigger>
      {compact ? content : <Portal>{content}</Portal>}
    </Popover.Root>
  );
};
