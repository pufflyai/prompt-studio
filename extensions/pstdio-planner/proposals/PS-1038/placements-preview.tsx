import { Box, Button } from "@chakra-ui/react";
import { useRef, useState } from "react";
import type { ReviewRequestView } from "../../src/data/review-request-types";
import type { PlanRow } from "../../src/timeline/contracts";
import { AutoBuildIndicator } from "../../src/timeline/view/auto-build-indicator";
import { GraphCard } from "../../src/timeline/view/graph-card";
import { AutoBuildActivity } from "./auto-build-activity";
import { NeedsAttentionPreview } from "./needs-attention-preview";
import { RequestModal } from "./request-modal";
import { previewAgentSessions } from "./review-requests.story-fixture";

interface AutoBuildPreviewProps {
  requests: ReviewRequestView[];
  failSave?: boolean;
  empty?: boolean;
  warning?: boolean;
}

export function AutoBuildPreview(props: AutoBuildPreviewProps) {
  const { requests, failSave, empty, warning } = props;
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
        sessions={empty ? [] : previewAgentSessions}
        supervisor={
          empty
            ? null
            : { id: "demo-supervisor", title: "Coordinate the notes tool and importer", status: "in_progress" }
        }
        running={empty ? 0 : previewAgentSessions.length}
        stuck={warning}
        error={warning ? "An agent needs a decision before work can continue." : undefined}
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
  const [selected, setSelected] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  return (
    <>
      <Box position="relative" minH="xs">
        <GraphCard
          row={row}
          x={0}
          y={0}
          dropBefore={false}
          relation={selected ? "selected" : undefined}
          onSelect={() => setSelected(true)}
          onOpenRequests={() => {
            trigger.current = document.activeElement as HTMLElement;
            setOpen(true);
          }}
          onDragStart={() => {}}
          onDragOver={() => {}}
          onDrop={() => {}}
        />
      </Box>
      <RequestModal
        title={`${row.shorthand} · ${row.title}`}
        requests={row.requests}
        open={open}
        onClose={() => setOpen(false)}
        finalFocusEl={() => trigger.current}
      />
    </>
  );
}
