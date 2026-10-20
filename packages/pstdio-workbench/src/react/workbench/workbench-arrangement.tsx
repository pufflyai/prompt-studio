import { Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { resolveArrangement } from "../../core/registries/layout/panel-positions";
import { WorkbenchPanelEdgeTargets } from "../region/panel-edge-targets";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActivityBar } from "./workbench-panels";

export const useWorkbenchArrangement = (workbench: WorkbenchCore) => {
  const saved = useWorkbenchStore(workbench.layout.store, (state) => state.layout.arrangement);
  return resolveArrangement(saved);
};

export const WorkbenchArrangementFrame = (props: {
  workbench: WorkbenchCore;
  activityVisible: boolean;
  children: ReactNode;
}) => {
  const { workbench, activityVisible, children } = props;
  const { activity } = useWorkbenchArrangement(workbench);
  return (
    <Flex
      position="relative"
      h="full"
      w="full"
      minH="0"
      minW="0"
      direction={
        { left: "row", right: "row-reverse", top: "column", bottom: "column-reverse" }[activity] as
          | "row"
          | "row-reverse"
          | "column"
          | "column-reverse"
      }
    >
      <WorkbenchActivityBar workbench={workbench} visible={activityVisible} />
      <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
        {children}
      </Flex>
      <WorkbenchPanelEdgeTargets workbench={workbench} />
    </Flex>
  );
};
