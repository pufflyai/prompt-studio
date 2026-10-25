import { Box, Flex, IconButton, Input, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { KanbanRendererCard } from "../kanban-renderer/kanban-renderer-card";
import { DependencyTimeline } from "./dependency-timeline";
import type { DependencyTimelineProps, TimelineDropTarget } from "./dependency-timeline.types";

interface ExampleProps extends Pick<DependencyTimelineProps, "onContext" | "onCreateSection"> {
  large?: boolean;
  empty?: boolean;
  selectedId?: string;
}

const EditablePreview = () => {
  const [draft, setDraft] = useState("");
  return <Input aria-label="Timeline draft" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />;
};

interface ExampleHeaderProps {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}

const ExampleHeader = (props: ExampleHeaderProps) => {
  const { label, collapsed, onToggle } = props;
  return (
    <Flex h="full" bg="bg" align="center" gap="sm">
      <IconButton
        size="2xs"
        variant="ghost"
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
        onClick={onToggle}
      >
        {collapsed ? <ChevronRight /> : <ChevronDown />}
      </IconButton>
      <Text textStyle="label/S/medium">{label}</Text>
    </Flex>
  );
};

export const DependencyTimelineExample = (props: ExampleProps) => {
  const { large = false, empty = false, selectedId: initialSelection, onContext, onCreateSection } = props;
  const [selectedId, setSelectedId] = useState(initialSelection);
  const [draggedId, setDraggedId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<TimelineDropTarget>();
  const [closedTracks, setClosedTracks] = useState<string[]>([]);
  const [closedSections, setClosedSections] = useState<string[]>([]);
  const [placement, setPlacement] = useState<Record<string, { sectionId: string | null; trackId: string }>>({});
  const source = large
    ? Array.from({ length: 1000 }, (_, index) => ({
        id: `work-${index}`,
        title: `Work item ${index + 1}`,
        trackId: "api",
        sectionId: "preview",
        dependencies: index ? [{ id: `work-${index - 1}` }] : [],
      }))
    : [
        { id: "api", title: "Build the shared API", trackId: "api", sectionId: "preview", dependencies: [] },
        {
          id: "preview",
          title: "Preview the working component",
          trackId: "design",
          sectionId: "preview",
          dependencies: [{ id: "api", done: true }],
        },
        {
          id: "ship",
          title: "Ship the component after reviewing the preview",
          trackId: "api",
          sectionId: "launch",
          dependencies: [{ id: "preview" }],
        },
      ];
  const items = (empty ? [] : source).map((item) => ({
    ...item,
    ...placement[item.id],
    related: selectedId !== undefined,
    content: (
      <KanbanRendererCard
        title={item.title}
        eyebrow={item.id.toUpperCase()}
        isSelected={selectedId === item.id}
        onClick={() => setSelectedId(item.id)}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", item.id);
          setDraggedId(item.id);
        }}
        customSlots={item.id === "api" ? [<EditablePreview key="draft" />] : undefined}
      />
    ),
  }));
  const toggle = (values: string[], id: string) =>
    values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
  return (
    <Box h="600px">
      <DependencyTimeline
        aria-label="Release timeline"
        today="2026-10-10"
        selectedId={selectedId}
        draggedId={draggedId}
        dropTarget={dropTarget}
        tracks={[
          { id: "api", label: "API" },
          { id: "design", label: "Design" },
        ].map((track) => ({ ...track, collapsed: closedTracks.includes(track.id) }))}
        sections={[
          { id: "preview", label: "Preview", date: "2026-10-15" },
          { id: "launch", label: "Launch", date: "2026-10-22" },
        ].map((section) => ({
          ...section,
          collapsed: closedSections.includes(section.id),
          header: (
            <ExampleHeader
              label={section.label}
              collapsed={closedSections.includes(section.id)}
              onToggle={() => setClosedSections((current) => toggle(current, section.id))}
            />
          ),
          items: items.filter((item) => item.sectionId === section.id),
        }))}
        onToggleTrack={(id) => setClosedTracks((current) => toggle(current, id))}
        onContext={onContext}
        onCreateSection={onCreateSection}
        onDropTarget={setDropTarget}
        onDrop={() => {
          if (draggedId && dropTarget)
            setPlacement((current) => ({
              ...current,
              [draggedId]: {
                sectionId: dropTarget.sectionId,
                trackId: dropTarget.trackId ?? items.find(({ id }) => id === draggedId)!.trackId,
              },
            }));
          setDraggedId(undefined);
          setDropTarget(undefined);
        }}
      />
    </Box>
  );
};
