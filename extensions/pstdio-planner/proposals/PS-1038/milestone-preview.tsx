import { Box } from "@chakra-ui/react";
import { useRef, useState } from "react";
import type { PlanRow } from "../../src/timeline/contracts";
import type { ViewSection } from "../../src/timeline/view/plan-view";
import { SectionHeader } from "../../src/timeline/view/section-header";
import { RequestModal } from "./request-modal";

export function MilestoneNeedsAttentionPreview(props: { rows: PlanRow[] }) {
  const { rows } = props;
  const [answered, setAnswered] = useState<string[]>([]);
  const header = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const requests = rows.flatMap((row) => row.requests.filter((request) => request.state === "open"));
  const name = "Notes tool preview";
  const entry: ViewSection = {
    collapsed: false,
    rows,
    section: {
      rows,
      deadline: { id: "demo-milestone", name, date: "2026-11-10", daysLeft: 7 },
      eta: null,
      counts: {
        total: rows.length,
        done: 0,
        humanNeeded: rows.filter((row) =>
          row.requests.some((request) => request.state === "open" && !answered.includes(request.id)),
        ).length,
        blocked: 0,
        atRisk: 0,
      },
    },
  };
  return (
    <>
      <Box
        h="10"
        ref={header}
        onClickCapture={(event) => {
          if (event.target instanceof Element) event.target.closest("button")?.focus({ preventScroll: true });
        }}
      >
        <SectionHeader
          entry={entry}
          onToggle={() => {}}
          onDelete={() => {}}
          onRenameDeadline={async () => {}}
          onReview={() => {
            trigger.current = document.activeElement as HTMLElement;
            setOpen(true);
          }}
        />
      </Box>
      <RequestModal
        title={name}
        requests={requests}
        open={open}
        answered={answered}
        onAnswered={(id) => setAnswered((current) => [...current, id])}
        onClose={() => setOpen(false)}
        finalFocusEl={() =>
          trigger.current?.isConnected ? trigger.current : (header.current?.querySelector("button") ?? null)
        }
      />
    </>
  );
}
