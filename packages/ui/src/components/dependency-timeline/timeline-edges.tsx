// Draw dependency edges from each dependency card to the card that waits on it.
import { chakra } from "@chakra-ui/react";
import type { TimelineItem } from "./dependency-timeline.types";
import { edgePath, type NodeBox } from "./edge-path";
import { timelineLayers } from "./timeline-layers";
import { edgeIntersectsWindow } from "./timeline-window";

interface TimelineEdgesProps {
  items: TimelineItem[];
  positions: Map<string, NodeBox>;
  width: number;
  height: number;
  selectedId?: string;
  bounds: NodeBox;
}

export function TimelineEdges(props: TimelineEdgesProps) {
  const { items, positions, width, height, selectedId, bounds } = props;
  const relatedIds = new Set(items.filter(({ related }) => related).map(({ id }) => id));
  const edges = items.flatMap((row) =>
    row.dependencies.flatMap((dependency) => {
      const from = positions.get(dependency.id);
      const to = positions.get(row.id);
      return from && to && edgeIntersectsWindow(from, to, bounds)
        ? [
            {
              key: `${dependency.id}-${row.id}`,
              done: Boolean(dependency.done),
              related: relatedIds.has(row.id) && relatedIds.has(dependency.id),
              ...edgePath(from, to),
            },
          ]
        : [];
    }),
  );

  const layers = [
    { key: "background", zIndex: timelineLayers.arrows, edges: edges.filter((edge) => !selectedId || !edge.related) },
    {
      key: "hierarchy",
      zIndex: timelineLayers.hierarchyArrows,
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
  const color = edge.upward ? "orange.fg" : "fg.subtle";
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
