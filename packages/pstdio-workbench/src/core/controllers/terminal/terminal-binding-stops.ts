import type {
  WorkbenchTerminalController,
  WorkbenchTerminalSessionAdapter,
  WorkbenchTerminalState,
} from "./terminal-controller-types";

interface BindingStop {
  id: string;
  stop(): Promise<void>;
}

type BindingStopLookup = (bindingId: string, ownerId?: string) => BindingStop | undefined;

const owners = new WeakMap<WorkbenchTerminalController, BindingStopLookup>();

export const registerTerminalBindingStops = (terminal: WorkbenchTerminalController, lookup: BindingStopLookup) => {
  owners.set(terminal, lookup);
  return terminal;
};

export const captureTerminalBindingStop = (
  terminal: WorkbenchTerminalController,
  bindingId: string,
  ownerId?: string,
) => owners.get(terminal)?.(bindingId, ownerId);

export const createTerminalBindingStops = (
  adapters: ReadonlyMap<string, WorkbenchTerminalSessionAdapter>,
  sessions: () => WorkbenchTerminalState["sessionsById"],
  kill: WorkbenchTerminalController["kill"],
) => {
  const stops = new Map<string, BindingStop>();
  const stopAdapter = async (adapter: WorkbenchTerminalSessionAdapter, stillBound: () => boolean) => {
    const current = adapters.get(adapter.id);
    const status = sessions()[adapter.id]?.status;
    const endedHere = !current && stillBound() && (status === "exited" || status === "killed");
    if (current !== adapter && !endedHere) throw new Error("The original terminal session can no longer be confirmed.");
    await kill({ sessionId: adapter.id });
  };
  return {
    get: (id: string) => stops.get(id),
    clear: (id: string) => stops.delete(id),
    capture(
      id: string,
      opening: Promise<{ sessionId: string }>,
      original: () => WorkbenchTerminalSessionAdapter | undefined,
    ) {
      const stillBound = () => stops.get(id) === captured;
      const captured: BindingStop = {
        id: crypto.randomUUID(),
        async stop() {
          const available = original();
          if (available) return stopAdapter(available, stillBound);
          await opening;
          const adapter = original();
          if (!adapter) throw new Error("The original terminal session can no longer be confirmed.");
          return stopAdapter(adapter, stillBound);
        },
      };
      stops.set(id, captured);
      void opening.catch(() => {
        if (stillBound()) stops.delete(id);
      });
    },
  };
};
