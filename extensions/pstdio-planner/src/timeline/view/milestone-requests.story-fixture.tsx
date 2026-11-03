import { Box } from "@chakra-ui/react";
import { useRef, useState } from "react";
import type { PlanRow } from "../contracts";
import type { ViewSection } from "./plan-view";
import { SectionHeader } from "./section-header";
import { TicketRequestsDialog } from "./ticket-requests-dialog";

export function MilestoneNeedsAttentionPreview(props: { rows: PlanRow[] }) {
  const [rows, setRows] = useState(props.rows);
  const [open, setOpen] = useState(false);
  const fallback = useRef<HTMLButtonElement | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
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
        humanNeeded: rows.filter((row) => row.requests.some((request) => request.state === "open")).length,
        blocked: 0,
        atRisk: 0,
      },
    },
  };
  return (
    <>
      <Box h="10">
        <SectionHeader
          entry={entry}
          onToggle={() => {}}
          onDelete={() => {}}
          onRenameDeadline={async () => {}}
          onReview={(_id, button, returnTo) => {
            trigger.current = button;
            fallback.current = returnTo;
            setOpen(true);
          }}
        />
      </Box>
      <TicketRequestsDialog
        title={name}
        rows={rows}
        trigger={trigger.current}
        fallback={fallback.current}
        onAnswer={async (id, response) => {
          setRows((current) =>
            current.map((row) => ({
              ...row,
              requests: row.requests.map((request) =>
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
            })),
          );
        }}
        onOpenChat={async () => {}}
        open={open}
        pendingOnly
        onClose={() => setOpen(false)}
      />
    </>
  );
}
