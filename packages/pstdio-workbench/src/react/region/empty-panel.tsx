import { EmptyState } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { usePanelPolicy } from "../shared/use-panel-policy";

export const EmptyPanel = (props: { workbench: WorkbenchCore; region: WorkbenchRegion; occupied: boolean }) => {
  const { workbench, region, occupied } = props;
  const policy = usePanelPolicy(workbench, region);
  if (region !== "side" && region !== "secondary" && region !== "bottom" && region !== "aside") return null;
  if (occupied || !policy.open || !policy.acceptsTabs) return null;
  return <EmptyState title="Drop a tab here" size="sm" />;
};
