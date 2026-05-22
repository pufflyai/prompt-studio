import { HStack } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { DashboardSessionSelector } from "./session-selector";

export const SessionBubbleHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <HStack h="full" minW="0" gap="1">
      <DashboardSessionSelector input={input} />
    </HStack>
  );
};
