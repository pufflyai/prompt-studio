import { Flex } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { resolveMainFrameNode } from "../frame/frame-tree";
import { FrameView } from "../frame/frame-view";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
}

export const WorkbenchBody = (props: WorkbenchBodyProps) => {
  const { workbench } = props;
  const frame = useWorkbenchStore(workbench.layout.store, (state) => state.frame);
  const body = resolveMainFrameNode(frame);

  return (
    <Flex as="main" h="full" minH="0" minW="0" w="full" overflow="hidden">
      <FrameView workbench={workbench} frame={frame} node={body} />
    </Flex>
  );
};
