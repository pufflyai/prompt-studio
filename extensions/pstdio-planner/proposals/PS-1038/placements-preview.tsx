import { Box, Button, CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useRef, useState } from "react";
import type { ReviewRequestView } from "../../src/data/review-request-types";
import type { PlanRow } from "../../src/timeline/contracts";
import { AutoBuildIndicator } from "../../src/timeline/view/auto-build-indicator";
import { GraphCard } from "../../src/timeline/view/graph-card";
import { AutoBuildActivity } from "./auto-build-activity";
import { NeedsAttentionPreview } from "./needs-attention-preview";
import { previewAgentSessions } from "./review-requests.story-fixture";

interface AutoBuildPreviewProps {
  requests: ReviewRequestView[];
  failSave?: boolean;
}

export function AutoBuildPreview(props: AutoBuildPreviewProps) {
  const { requests, failSave } = props;
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={anchor} size="xs" variant="outline" onClick={() => setOpen(true)}>
        <AutoBuildIndicator status={paused ? "paused" : "awaiting_input"} label="Auto Build needs attention" />
        Auto Build
      </Button>
      <AutoBuildActivity
        open={open}
        anchor={anchor}
        enabled={!paused}
        paused={paused}
        failed={false}
        sessions={previewAgentSessions}
        supervisor={{ id: "demo-supervisor", title: "Coordinate the notes tool and importer", status: "in_progress" }}
        running={previewAgentSessions.length}
        capacity={3}
        onClose={() => setOpen(false)}
        onStop={() => setOpen(false)}
        onConfigure={() => {}}
        onPause={async () => {
          setPaused(true);
          return true;
        }}
        onResume={async () => {
          setPaused(false);
          return true;
        }}
        onOpenSession={() => {}}
        t={(_key, fallback) => fallback ?? _key}
        attention={<NeedsAttentionPreview requests={requests} failSave={failSave} />}
      />
    </>
  );
}

export function CardNeedsAttentionPreview(props: { row: PlanRow }) {
  const { row } = props;
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="md"
      scrollBehavior="inside"
      finalFocusEl={() => card.current?.querySelector<HTMLElement>("[data-ticket]") ?? null}
    >
      <Box ref={card} position="relative" minH="xs">
        <GraphCard
          row={row}
          x={0}
          y={0}
          dropBefore={false}
          onSelect={() => setOpen(true)}
          onOpenRequests={() => setOpen(true)}
          onDragStart={() => {}}
          onDragOver={() => {}}
          onDrop={() => {}}
        />
      </Box>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {row.shorthand} · {row.title}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea>
                <NeedsAttentionPreview requests={row.requests} />
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
