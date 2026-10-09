import type { WorkbenchCore, WorkbenchTabSnapshot } from "../../core";
import { WorkbenchIcon } from "./icon";
import { runPlacementAction } from "./run-placement-action";

export const placementMenuActions = (workbench: WorkbenchCore, snapshot: WorkbenchTabSnapshot) =>
  (snapshot.menu ?? []).flatMap((group, groupIndex) =>
    group.rows.map((row, index) => ({
      key: `${group.id}:${row.id}`,
      label: row.label,
      icon: row.icon ? <WorkbenchIcon name={row.icon} size={14} /> : undefined,
      isDisabled: row.disabled,
      separatorBefore: groupIndex > 0 && index === 0,
      onClick: () => {
        if (row.action) runPlacementAction(workbench, row.action);
      },
    })),
  );
