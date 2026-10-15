import { Box } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import type { PanelEdge } from "@pstdio/sdk/extensions";
import { DropIndicator } from "@pstdio/ui";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { geometryEdge } from "../../core/registries/layout/panel-geometry";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { panelDropLabel } from "./panel-destination-labels";
import { type GeometryDrag, geometryPositions, panelPositionLabel } from "./panel-drag-area";
import { useTabDrag } from "./tab-drag-context";

const edgePosition = {
  left: { left: "0", top: "0", bottom: "0", w: "12" },
  right: { right: "0", top: "0", bottom: "0", w: "12" },
  top: { top: "0", left: "0", right: "0", h: "12" },
  bottom: { bottom: "0", left: "0", right: "0", h: "12" },
} as const;
interface EdgeTargetProps {
  workbench: WorkbenchCore;
  edge: PanelEdge;
  region?: WorkbenchPanelRegion;
  panel?: GeometryDrag;
  inner: boolean;
}
const EdgeTarget = (props: EdgeTargetProps) => {
  const { workbench, edge, region, panel, inner } = props;
  const id = useId();
  const { drop, geometryDrop, destinations } = useTabDrag();
  const element = useRef<HTMLDivElement | null>(null);
  const [inset, setInset] = useState(false);
  useLayoutEffect(() => {
    if (!inner || !region) return;
    const page = element.current?.parentElement;
    const frame = page?.closest<HTMLElement>("[data-workbench-drag-frame]");
    if (!page || !frame) return;
    const outer = frame.getBoundingClientRect();
    const local = page.getBoundingClientRect();
    const distance = {
      left: local.left - outer.left,
      right: outer.right - local.right,
      top: local.top - outer.top,
      bottom: outer.bottom - local.bottom,
    }[edge];
    const outerAtEdge = ["side", "secondary"] as const;
    setInset(
      distance < 48 &&
        outerAtEdge.some(
          (panel) =>
            !workbench.shell.getPanelPolicy(panel).open &&
            workbench.getPanelEdge(panel) === edge &&
            destinations?.includes(panel),
        ),
    );
  }, [workbench, inner, region, edge, destinations]);
  const { setNodeRef } = useDroppable({ id, data: { region, panel, edge, closedEdge: true, priority: inner ? 1 : 2 } });
  const highlighted = region ? drop?.region === region : geometryDrop?.panel === panel && geometryDrop?.edge === edge;
  const label = region ? panelDropLabel(workbench, region) : panelPositionLabel(panel!, edge);
  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        element.current = node;
        setNodeRef(node);
      }}
      data-workbench-edge-target={region ?? panel}
      data-edge={edge}
      data-drop-active={highlighted || undefined}
      {...edgePosition[edge]}
      {...(inset ? { [edge]: "12" } : {})}
      position="absolute"
      zIndex="popover"
      display="flex"
      alignItems="center"
      justifyContent="center"
      layerStyle="tabDropZone"
      textStyle="label/XS/medium"
      pointerEvents="auto"
    >
      <Box pointerEvents="none">{label}</Box>
      {highlighted ? <DropIndicator bottom="0" /> : null}
    </Box>
  );
};
export const PanelEdgeTargets = (props: { workbench: WorkbenchCore; inner?: boolean; content?: boolean }) => {
  const { workbench, inner = false, content = false } = props;
  const { activeId, panel, destinations } = useTabDrag();
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  if (panel) {
    const local = panel === "aside" || panel === "bottom";
    const onMain = panel === "side" || panel === "main" || panel === "secondary";
    if (local !== inner || onMain !== content) return null;
    return geometryPositions(workbench, panel, layout).map((edge) => (
      <EdgeTarget key={edge} workbench={workbench} edge={edge} panel={panel} inner={inner} />
    ));
  }
  if (!activeId) return null;
  if (content) return null;
  const regions: WorkbenchPanelRegion[] = inner ? ["aside", "bottom"] : ["side", "secondary"];
  return regions
    .filter((region) => destinations?.includes(region) && !workbench.fullscreen.isRegionVisible(region))
    .map((region) => (
      <EdgeTarget
        key={region}
        workbench={workbench}
        region={region}
        edge={geometryEdge(layout, region)}
        inner={inner}
      />
    ));
};
