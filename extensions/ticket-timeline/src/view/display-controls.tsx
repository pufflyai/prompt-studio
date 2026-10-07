// Small controls for the display menu, styled like the host's Kanban display menu.
import { HStack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";

export const SectionLabel = ({ children }: { children: string }) => (
  <Text paddingX="xs" paddingTop="xs" paddingBottom="2xs" textStyle="label/XS/medium" color="fg.muted">
    {children}
  </Text>
);

export function ToggleRow(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <HStack paddingX="xs" paddingY="2xs">
      <Text textStyle="label/S/regular" flex="1">
        {props.label}
      </Text>
      <Switch
        size="sm"
        aria-label={props.label}
        checked={props.checked}
        onCheckedChange={(details) => props.onChange(details.checked)}
      />
    </HStack>
  );
}
