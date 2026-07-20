import { Stack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "../../../core";

interface ResourcePanelProps {
  input: WorkbenchWidgetRenderInput;
  anchor: string;
}

// Renders whatever resource its placement holds. Used for supporting anchors (a terminal in
// the derived `secondary`, a session in the detached `side`) so you can watch them
// appear, re-scope, and disconnect as the primary changes.
export const ResourcePanel = (props: ResourcePanelProps) => {
  const { input, anchor } = props;
  const resource = input.placement.resource;

  return (
    <Stack gap="2" p="4" h="full" minH="0">
      <Text textStyle="label/XS/regular" color="fg.muted">
        {anchor} anchor
      </Text>
      <Text textStyle="label/S/regular" color="fg">
        {resource?.label ?? "—"}
      </Text>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {resource?.uri}
      </Text>
    </Stack>
  );
};
