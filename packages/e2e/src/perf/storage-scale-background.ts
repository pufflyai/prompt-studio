import { type Background, owners, type Workload, workload } from "storage-scale-fixture";

export const scaleBackgroundOwner = (kind: Workload, operation: string, background: Background) => {
  const foreground = kind === "rich" && (operation === "board" || operation === "list") ? 9 : 0;
  const index = background === "other-owner-catchup" ? 1 : foreground;
  return owners(workload(kind))[index];
};
