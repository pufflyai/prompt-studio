import { Box } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import type { PanelEdge } from "@pstdio/sdk/extensions";
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

interface EdgePreviewProps {
  workbench: WorkbenchCore;
  edge: PanelEdge;
  region: GeometryDrag;
  inset: boolean;
  label: string;
}

const EdgePreview = (props: EdgePreviewProps) => {
  const { workbench, edge, region, inset, label } = props;
  const vertical = edge === "left" || edge === "right";
  const size = region === "activity" ? undefined : workbench.layout.getRegionSize(region)?.defaultPx;
  const extent = size ?? (vertical ? 280 : 160);
  const offset = inset ? "-12" : "0";
  return (
    <Box
      position="absolute"
      {...(vertical
        ? { top: "0", bottom: "0", [edge]: offset, w: extent }
        : { left: "0", right: "0", [edge]: offset, h: extent })}
      layerStyle="tabDropZone"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p="sm"
      pointerEvents="none"
      data-workbench-edge-preview={region}
    >
      <Box layerStyle="panelDropLabel">{label}</Box>
    </Box>
  );
};

const EdgeTarget = (props: EdgeTargetProps) => {
  const { workbench, edge, region, panel, inner } = props;
  const id = useId();
  const { activeId, drop, geometryDrop, destinations } = useTabDrag();
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
  const allowed = Boolean(panel || (activeId && region && destinations?.includes(region)));
  const { setNodeRef } = useDroppable({
    id,
    disabled: !allowed,
    data: { region, panel, edge, closedEdge: true, priority: inner ? 1 : 2 },
  });
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
      textStyle="label/XS/medium"
      pointerEvents={allowed ? "auto" : "none"}
    >
      {highlighted ? (
        <EdgePreview workbench={workbench} region={region ?? panel!} edge={edge} inset={inset} label={label} />
      ) : null}
    </Box>
  );
};
interface PanelEdgeTargetsProps {
  workbench: WorkbenchCore;
  pageRegion?: "aside" | "bottom";
  content?: boolean;
}

export const PanelEdgeTargets = (props: PanelEdgeTargetsProps) => {
  const { workbench, pageRegion, content = false } = props;
  const inner = pageRegion !== undefined;
  const { panel } = useTabDrag();
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  if (panel) {
    const local = panel === "aside" || panel === "bottom";
    const onMain = panel === "side" || panel === "main" || panel === "secondary";
    if (local !== inner || onMain !== content || (inner && panel !== pageRegion)) return null;
    return geometryPositions(workbench, panel, layout).map((edge) => (
      <EdgeTarget key={edge} workbench={workbench} edge={edge} panel={panel} inner={inner} />
    ));
  }
  if (content) return null;
  const regions: WorkbenchPanelRegion[] = pageRegion ? [pageRegion] : ["side", "secondary"];
  return regions
    .filter(
      (region) => workbench.shell.getPanelPolicy(region).provided && !workbench.fullscreen.isRegionVisible(region),
    )
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
