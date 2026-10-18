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
} & Pick<ReturnType<typeof useViewSections>, "sections" | "toggle"> &
  Pick<PlanViewProps, "tracks">) {
  const [selectedId, setSelectedId] = useState<string>();
  const [editor, setEditor] = useState<Editor>();
  const [context, setContext] = useState<BackgroundContext>();
  const dnd = useDragAndDrop(client);
  const selected = plan?.sections.flatMap(({ rows }) => rows).find(({ id }) => id === selectedId);
  const relations = relationsFor(selected, plan);
  const open = (target: NavigationTarget) => void host.call("navigation.open", { target });
  const [reviewDeadline, setReviewDeadline] = useState<{ id: string | null }>();
  const review = reviewDeadline
    ? reviewQueue(sections.find(({ section }) => (section.deadline?.id ?? null) === reviewDeadline.id)?.rows ?? [])
    : undefined;
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
      client.commands["timeline.deadline.update"]({ deadline, name: name || "none" }),
    onRedate: (deadline, date) => client.commands["timeline.deadline.update"]({ deadline, date }),
    onRenameTrack: (track, name) => client.commands["timeline.track.rename"]({ track, name }),
    onReview: (deadlineId) => {
      const rows = sections.find(({ section }) => (section.deadline?.id ?? null) === deadlineId)?.rows ?? [];
      const queue = reviewQueue(rows);
      setReviewDeadline({ id: deadlineId });
      setSelectedId(queue[0]);
    },
    onDelete: (deadline) => {
      // Command failures are already reported by host chrome.
      void client.commands["timeline.deadline.delete"]({ deadline }).catch(() => {});
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
    setSelectedId,
    setContext,
    setEditor,
    done,
  };
}
