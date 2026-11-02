import { Box, Button } from "@chakra-ui/react";
import { useRef, useState } from "react";
import type { ReviewRequestView } from "../../data/review-request-types";
import type { PlanRow } from "../contracts";
import { AutoBuildActivity } from "./auto-build-activity";
import { AutoBuildIndicator } from "./auto-build-indicator";
import { GraphCard } from "./graph-card";
import { TicketRequestsDialog } from "./ticket-requests-dialog";

interface AutoBuildPreviewProps {
  requests: ReviewRequestView[];
  failSave?: boolean;
}

export function AutoBuildPreview(props: AutoBuildPreviewProps) {
  const { requests, failSave } = props;
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  return (
    <AutoBuildActivity
      open={open}
      trigger={
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <AutoBuildIndicator status={paused ? "paused" : "awaiting_input"} label="Auto Build needs attention" />
          Auto Build
        </Button>
      }
      enabled={!paused}
      paused={paused}
      failed={false}
      sessions={[]}
      supervisor={{ id: "supervisor", title: "Build the notes tool", status: "completed" }}
      running={0}
      capacity={2}
      onOpenChange={setOpen}
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
      reviewRequests={requests}
      onAnswerRequest={async () => {
        if (failSave) throw new Error("Unable to save. Try again.");
      }}
      onOpenRequestChat={async () => {}}
    />
  );
}

export function CardNeedsAttentionPreview(props: { row: PlanRow }) {
  const { row } = props;
  const [open, setOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  return (
    <>
      <Box ref={card} position="relative" minH="xs">
        <GraphCard
          row={row}
          x={0}
          y={0}
          dropBefore={false}
          onSelect={() => {}}
          onOpenRequests={() => setOpen(true)}
          onDragStart={() => {}}
          onDragOver={() => {}}
          onDrop={() => {}}
        />
      </Box>
      {open ? (
        <TicketRequestsDialog
          row={row}
          trigger={card.current?.querySelector<HTMLElement>("[data-ticket]") ?? null}
          onClose={() => setOpen(false)}
          onAnswer={async () => {}}
          onOpenChat={async () => {}}
        />
      ) : null}
    </>
  );
}
