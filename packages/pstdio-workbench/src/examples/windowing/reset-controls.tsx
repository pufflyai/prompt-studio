import { Button, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { geometryEdge } from "../../core/registries/layout/panel-geometry";
import { useWorkbenchStore } from "../../react";

export const WindowingResetControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  return (
    <>
      <Button
        size="xs"
        variant="outline"
        onClick={() => void workbench.commands.executeCommand("workbench.resetModeLayout")}
      >
        Reset mode layout
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          workbench.repositionPanel("aside", "left");
          workbench.shell.setRegionSize("aside", 350);
        }}
      >
        Move and resize page side
      </Button>
      <Text aria-label="Page side geometry" textStyle="paragraph/XS/regular">
        {geometryEdge(layout, "aside")} · {layout.regions.aside.size ?? "default"}
      </Text>
    </>
  );
};
