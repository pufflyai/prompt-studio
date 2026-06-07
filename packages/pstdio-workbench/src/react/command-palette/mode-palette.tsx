import type { PaletteEntry } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchModeContribution } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { MODE_VIEW_ID } from "./palette-view";

export interface WorkbenchModePaletteEntry extends PaletteEntry {
  modeId: string;
  mode: typeof MODE_VIEW_ID;
}

const getModeLabel = (mode: WorkbenchModeContribution) => mode.label ?? mode.id;

export const getModeEntryIndex = (activeModeId: string | undefined, modes: readonly WorkbenchModeContribution[]) => {
  const index = modes.findIndex((mode) => mode.id === activeModeId);

  return Math.max(index, 0);
};

export const createWorkbenchModePaletteEntries = (input: { workbench: WorkbenchCore; onClose: () => void }) => {
  const { onClose, workbench } = input;
  const activeModeId = workbench.modes.getActiveModeId();

  return workbench.modes.listModes().map((mode): WorkbenchModePaletteEntry => {
    const label = getModeLabel(mode);

    return {
      id: `mode:${mode.id}`,
      modeId: mode.id,
      mode: MODE_VIEW_ID,
      label,
      searchText: `mode workbench ${mode.id} ${label}`,
      group: "Modes",
      icon: <WorkbenchIcon name="PanelTop" />,
      isSelected: mode.id === activeModeId,
      onActivate: () => {
        workbench.modes.setActiveMode(mode.id);
        onClose();
      },
    };
  });
};
