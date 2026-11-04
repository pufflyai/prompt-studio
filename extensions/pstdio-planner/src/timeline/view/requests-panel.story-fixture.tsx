import { Box } from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewRequestView } from "../../data/review-request-types";
import type { PlanRow } from "../contracts";
import { AutoBuildButton } from "./auto-build-button";
import { GraphCard } from "./graph-card";
import { TicketRequestsDialog } from "./ticket-requests-dialog";

interface AutoBuildPreviewProps {
  requests: ReviewRequestView[];
  failSave?: boolean;
  empty?: boolean;
  warning?: boolean;
}

export function AutoBuildPreview(props: AutoBuildPreviewProps) {
  const { requests, failSave, empty, warning } = props;
  const [paused, setPaused] = useState(false);
  const [pending, setPending] = useState(requests);
  return (
    <AutoBuildButton
      enabled={!paused}
      paused={paused}
      sessions={empty ? [] : [{ id: "demo-agent", title: "Build notes sharing", status: "awaiting_input" }]}
      supervisor={empty ? null : { id: "supervisor", title: "Build the notes tool", status: "in_progress" }}
      stuck={warning}
      error={warning ? "An agent needs a decision before work can continue." : undefined}
      running={empty ? 0 : 1}
      capacity={2}
      onStop={async () => true}
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
      reviewRequests={pending}
      onAnswerRequest={async (id) => {
        if (failSave) throw new Error("Unable to save. Try again.");
        setPending((current) => current.filter((request) => request.id !== id));
      }}
      onOpenRequestChat={async () => {
        throw new Error("Session navigation is unavailable in this isolated preview.");
      }}
    />
  );
}

export function CardNeedsAttentionPreview(props: { row: PlanRow }) {
  const [row, setRow] = useState(props.row);
  const [pendingOnly, setPendingOnly] = useState(() => row.requests.some(({ state }) => state === "open"));
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <>
      <Box position="relative" minH="xs">
        <GraphCard
          row={row}
          x={0}
          y={0}
          dropBefore={false}
          onSelect={() => {}}
          onOpenRequests={() => {
            setPendingOnly(row.requests.some(({ state }) => state === "open"));
            setTrigger(document.activeElement as HTMLElement | null);
            setOpen(true);
          }}
          onDragStart={() => {}}
          onDragOver={() => {}}
          onDrop={() => {}}
        />
      </Box>
      <TicketRequestsDialog
        rows={[row]}
        title={`${row.shorthand} · ${row.title}`}
        open={open}
        pendingOnly={pendingOnly}
        trigger={trigger}
        onClose={() => setOpen(false)}
        onAnswer={async (id, response) => {
          setRow((current) => ({
            ...current,
            requests: current.requests.map((request) =>
              request.id === id
                ? {
                    ...request,
                    state: "answered",
                    outcome: {
                      kind: "answered",
                      at: "2026-11-03T12:00:00.000Z",
                      by: { type: "human", id: "demo", displayName: "Human" },
                      response,
                    },
                  }
                : request,
            ),
          }));
        }}
        onOpenChat={async () => {
          throw new Error("Session navigation is unavailable in this isolated preview.");
        }}
      />
    </>
  );
}
