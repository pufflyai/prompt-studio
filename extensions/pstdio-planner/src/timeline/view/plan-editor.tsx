// Mount one native dialog to create a track, ticket, agent gate, or milestone.
import { Dialog, Portal } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import type { Plan } from "../contracts";
import { DeadlineForm } from "./deadline-form";
import { type CreateContext, TicketForm } from "./ticket-form";
import { TrackForm } from "./track-form";
import type { PlanClient } from "./use-plan";

export type Editor =
  | { kind: "track" }
  | { kind: "ticket" | "gate"; context: CreateContext }
  | { kind: "deadline"; date?: string };

interface PlanEditorProps {
  editor: Editor;
  host: GuestHost;
  t: (key: string, fallback?: string) => string;
  client: PlanClient;
  plan: Plan;
  onDone: (ticketId?: string) => void;
}

export function PlanEditor(props: PlanEditorProps) {
  const { editor, host, t, client, plan, onDone } = props;
  let title = "New milestone";
  if (editor.kind === "track") {
    title = "New feature track";
  }
  if (editor.kind === "ticket") {
    title = "New ticket";
  }
  if (editor.kind === "gate") {
    title = "New agent gate";
  }
  if (editor.kind === "ticket" || editor.kind === "gate") {
    return (
      <TicketForm
        host={host}
        t={t}
        client={client}
        plan={plan}
        context={editor.context}
        kind={editor.kind}
        onDone={onDone}
      />
    );
  }
  return (
    <Dialog.Root
      open
      onOpenChange={({ open }) => {
        if (!open) {
          onDone();
        }
      }}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="md">
              {editor.kind === "track" ? <TrackForm client={client} onDone={onDone} /> : null}
              {editor.kind === "deadline" ? (
                <DeadlineForm client={client} initialDate={editor.date} onDone={onDone} />
              ) : null}
            </Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
