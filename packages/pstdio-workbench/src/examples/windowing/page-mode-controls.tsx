import { Button, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../../react";

export const WindowingModeControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const modeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  return (
    <>
      {workbench.modes.listModes().map((mode) => (
        <Button key={mode.id} size="xs" variant="outline" onClick={() => workbench.modes.setActiveMode(mode.id)}>
          {mode.label}
        </Button>
      ))}
      {workbench.pages
        .listAvailablePages(modeId)
        .filter((page) => page.id.startsWith("availability."))
        .map((page) => (
          <Button
            key={page.id}
            size="xs"
            variant="outline"
            onClick={() => workbench.pageLocations.navigate({ kind: "page", page: page.ref })}
          >
            {String(page.title)}
          </Button>
        ))}
      <Text aria-label="Current mode">{workbench.modes.getMode(modeId ?? "")?.label}</Text>
    </>
  );
};
