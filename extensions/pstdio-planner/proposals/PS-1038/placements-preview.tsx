import { Box, Button, useRecipe } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui/theme";
import { MessageCircleWarning } from "lucide-react";
import { useRef, useState } from "react";
import type { ReviewRequestView } from "../../src/data/review-request-types";
import type { PlanRow } from "../../src/timeline/contracts";
import { AutoBuildIndicator } from "../../src/timeline/view/auto-build-indicator";
import { GraphCard } from "../../src/timeline/view/graph-card";
import { AutoBuildActivity } from "./auto-build-activity";
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
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [answered, setAnswered] = useState<string[]>([]);
  const headerButton = useRecipe({ recipe: psTheme.getRecipe("button") })({ size: "xs", variant: "outline" });
  return (
    <>
      <Button ref={anchor} size="xs" css={headerButton} variant="outline" onClick={() => setOpen(true)}>
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
        attention={
          requests.some(({ id }) => !answered.includes(id)) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setRequestsOpen(true);
              }}
            >
              <MessageCircleWarning />
              Needs attention
            </Button>
          ) : null
        }
      />
      <RequestModal
        title="Needs attention"
        requests={requests}
        answered={answered}
        onAnswered={(id) => setAnswered((current) => [...current, id])}
        failSave={failSave}
        open={requestsOpen}
        onClose={() => setRequestsOpen(false)}
        finalFocusEl={() => anchor.current}
      />
    </>
  );
}

export function CardNeedsAttentionPreview(props: { row: PlanRow }) {
  const { row } = props;
  const [answered, setAnswered] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  return (
    <>
      <Box
        position="relative"
        minH="xs"
        onClickCapture={(event) => {
          if (event.target instanceof Element) event.target.closest("button")?.focus({ preventScroll: true });
        }}
      >
        <GraphCard
          row={{
            ...row,
            requests: row.requests.map((request) =>
              answered.includes(request.id) ? { ...request, state: "answered" } : request,
            ),
          }}
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
        answered={answered}
        onAnswered={(id) => setAnswered((current) => [...current, id])}
        title={`${row.shorthand} · ${row.title}`}
        requests={row.requests}
        open={open}
        onClose={() => setOpen(false)}
        finalFocusEl={() => trigger.current}
      />
    </>
  );
}
