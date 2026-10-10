// Own ticket selection, review navigation, editing, and canvas actions independently of the panel header.
import type { GuestHost, NavigationTarget } from "@pstdio/sdk/extensions";
import { useState } from "react";
import type { Plan } from "../contracts";
import { reviewQueue } from "../model/review";
import type { BackgroundContext } from "./background-menu";
import type { Editor } from "./plan-editor";
import { relationsFor, useDragAndDrop, type useViewSections } from "./plan-state";
import type { PlanViewProps } from "./plan-view";
import type { PlanClient } from "./use-plan";

export function usePlanActions({
  host,
  client,
  plan,
  sections,
  tracks,
  toggle,
}: {
  host: GuestHost;
  client: PlanClient;
  plan: Plan | undefined;
} & Pick<ReturnType<typeof useViewSections>, "sections" | "tracks" | "toggle">) {
  const [selectedId, setSelectedId] = useState<string>();
  const [editor, setEditor] = useState<Editor>();
  const [context, setContext] = useState<BackgroundContext>();
  const [actionError, setActionError] = useState<string>();
  const dnd = useDragAndDrop(client, setActionError);
  const selected = plan?.sections.flatMap(({ rows }) => rows).find(({ id }) => id === selectedId);
  const relations = relationsFor(selected, plan);
  const open = (target: NavigationTarget) => void host.call("navigation.open", { target });
  const [review, setReview] = useState<string[]>();
  // Inline edits revert when a save fails; the error stays visible above the graph.
  const run = (promise: Promise<unknown>) =>
    promise.catch((reason) => {
      setActionError(String(reason));
      throw reason;
    });
  const viewProps: Omit<PlanViewProps, "today"> = {
    sections,
    tracks,
    relations,
    selectedId,
    dragId: dnd.dragId,
    dropTarget: dnd.dropTarget,
    onSelect: setSelectedId,
    onDragStart: dnd.setDragId,
    onDragTarget: dnd.setDropTarget,
    onDrop: () => void dnd.drop(),
    onToggle: toggle,
    onRenameDeadline: (deadline, name) =>
      run(client.commands["timeline.deadline.update"]({ deadline, name: name || "none" })),
    onRedate: (deadline, date) => run(client.commands["timeline.deadline.update"]({ deadline, date })),
    onRenameTrack: (track, name) => run(client.commands["timeline.track.rename"]({ track, name })),
    onReview: (deadlineId) => {
      const rows = plan?.sections.find(({ deadline }) => (deadline?.id ?? null) === deadlineId)?.rows ?? [];
      const queue = reviewQueue(rows);
      setReview(queue);
      setSelectedId(queue[0]);
    },
    onDelete: (deadline) => {
      void client.commands["timeline.deadline.delete"]({ deadline }).catch((reason) => setActionError(String(reason)));
    },
    onContext: setContext,
    onNewTrack: () => setEditor({ kind: "track" }),
    onCreateDeadline: (date) => setEditor({ kind: "deadline", date }),
  };
  const done = (ticketId?: string) => {
    setEditor(undefined);
    if (ticketId) {
      setSelectedId(ticketId);
    }
  };
  return {
    viewProps,
    selected,
    open,
    review,
    editor,
    context,
    actionError,
    setSelectedId,
    setContext,
    setEditor,
    done,
  };
}
