// Draw dependency edges from each dependency card to the card that waits on it.
import { chakra } from "@chakra-ui/react";
import type { PlanRow } from "../contracts";
import { edgePath, type NodeBox } from "./edge-path";
import { toneColor } from "./flags";
import { graphLayers } from "./graph-layers";

interface GraphEdgesProps {
  rows: PlanRow[];
  positions: Map<string, NodeBox>;
  width: number;
  height: number;
  selectedId?: string;
  relatedIds: Set<string>;
  squareArrows: boolean;
}

export function GraphEdges(props: GraphEdgesProps) {
  const { rows, positions, width, height, selectedId, relatedIds, squareArrows } = props;
  const edges = rows.flatMap((row) =>
    row.dependsOn.flatMap((dependency) => {
      const from = positions.get(dependency.id);
      const to = positions.get(row.id);
      return from && to
        ? [
            {
              key: `${dependency.id}-${row.id}`,
              done: dependency.done,
              related: relatedIds.has(row.id) && relatedIds.has(dependency.id),
              ...edgePath(from, to, squareArrows),
            },
          ]
        : [];
    }),
  );

  const layers = [
    { key: "background", zIndex: graphLayers.arrows, edges: edges.filter((edge) => !selectedId || !edge.related) },
    {
      key: "hierarchy",
      zIndex: graphLayers.hierarchyArrows,
      edges: selectedId ? edges.filter((edge) => edge.related) : [],
    },
  ];
  return (
    <>
      {layers.map((layer) => (
        <chakra.svg
          key={layer.key}
          data-edge-layer={layer.key}
          position="absolute"
          top="0"
          left="0"
          width={`${width}px`}
          height={`${height}px`}
          pointerEvents="none"
          zIndex={layer.zIndex}
        >
          {layer.edges.map((edge) => (
            <DependencyEdge key={edge.key} edge={edge} selected={!!selectedId} />
          ))}
        </chakra.svg>
      ))}
    </>
  );
}

function DependencyEdge(props: {
  edge: ReturnType<typeof edgePath> & { related: boolean; done: boolean };
  selected: boolean;
}) {
  const { edge, selected } = props;
  const color = edge.upward ? toneColor.warning : "fg.subtle";
  const strong = edge.related ? "fg" : color;
  return (
    <g opacity={selected && !edge.related ? 0.2 : 1}>
      <chakra.path
        d={edge.path}
        fill="none"
        stroke={edge.related && !edge.upward ? strong : color}
        strokeWidth={edge.related ? 2 : 1.25}
        strokeDasharray={edge.upward || edge.done ? "4 4" : undefined}
      />
      <chakra.path d={edge.head} fill="none" stroke={edge.related && !edge.upward ? strong : color} strokeWidth={1.5} />
    </g>
  );
}
