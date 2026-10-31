import { createDisposable } from "../shared/disposable";
import { createWorkbenchStore } from "../shared/store/workbench-store";

interface PresenceParticipant {
  id: string;
  label: string;
}

interface PresenceSource {
  getParticipants(): readonly PresenceParticipant[];
  subscribe(listener: () => void): () => void;
}

/** Open views own their connections; chrome observes their combined live presence. */
export const createWorkbenchPresence = () => {
  const store = createWorkbenchStore<{ participants: readonly PresenceParticipant[] }>({
    name: "workbench.presence",
    initialState: { participants: [] },
  });
  const sources = new Map<symbol, { source: PresenceSource; unsubscribe: () => void }>();
  const refresh = () => {
    const people = new Map<string, PresenceParticipant>();
    for (const { source } of sources.values())
      for (const participant of source.getParticipants())
        if (!people.has(participant.id)) people.set(participant.id, participant);
    const participants = [...people.values()];
    const previous = store.getState().participants;
    if (
      participants.length === previous.length &&
      participants.every(
        (person, index) => person.id === previous[index]?.id && person.label === previous[index]?.label,
      )
    )
      return;
    store.setState({ participants });
  };
  return {
    store,
    register(source: PresenceSource) {
      const id = Symbol("presence source");
      sources.set(id, { source, unsubscribe: source.subscribe(() => refresh()) });
      refresh();
      return createDisposable(() => {
        sources.get(id)?.unsubscribe();
        sources.delete(id);
        refresh();
      });
    },
    dispose() {
      for (const { unsubscribe } of sources.values()) unsubscribe();
      sources.clear();
      refresh();
    },
  };
};

export type WorkbenchPresence = ReturnType<typeof createWorkbenchPresence>;
