import type { createWebviewClient } from "@pstdio/sdk/extensions";
import type { diagnosticCommands } from "./commands";
import { diagnosticsAutomationChanged, diagnosticsChanged } from "./events";
import { type DiagnosticKind, type DiagnosticView, diagnosticRunning } from "./types";

export type DiagnosticsClient = ReturnType<typeof createWebviewClient<typeof diagnosticCommands>>;
interface DiagnosticSnapshot {
  captures: DiagnosticView[];
  loading: boolean;
  error?: string;
}

export const createDiagnosticsStore = (client: DiagnosticsClient) => {
  let snapshot: DiagnosticSnapshot = { captures: [], loading: true };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let version = 0;
  let stopEvents: (() => void)[] = [];
  const publish = (value: DiagnosticSnapshot) => {
    snapshot = value;
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    const request = ++version;
    clearTimeout(timer);
    try {
      const captures = await client.commands["diagnostics.list"]();
      if (listeners.size === 0 || request !== version) return;
      publish({ captures, loading: false });
      if (captures.some(diagnosticRunning)) timer = setTimeout(() => void refresh(), 1000);
    } catch (error) {
      if (listeners.size > 0 && request === version) {
        publish({ ...snapshot, loading: false, error: String(error) });
        timer = setTimeout(() => void refresh(), 3000);
      }
    }
  };
  const perform = async (work: () => Promise<unknown>) => {
    version++;
    clearTimeout(timer);
    publish({ ...snapshot, loading: true, error: undefined });
    try {
      await work();
      await refresh();
    } catch (error) {
      publish({ ...snapshot, loading: false, error: String(error) });
    }
  };
  return {
    get: () => snapshot,
    refresh,
    start: (kind: DiagnosticKind, seconds: number) =>
      perform(() => client.commands["diagnostics.start"]({ kind, seconds })),
    cancel: (id: string) => perform(() => client.commands["diagnostics.cancel"]({ id })),
    export: (id: string) => client.commands["diagnostics.export"]({ id }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        stopEvents = [
          client.events.subscribe(diagnosticsChanged, () => void refresh()),
          client.events.subscribe(diagnosticsAutomationChanged, () => void refresh()),
        ];
        void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        version++;
        clearTimeout(timer);
        for (const stop of stopEvents) stop();
        stopEvents = [];
      };
    },
  };
};

export type DiagnosticsStore = ReturnType<typeof createDiagnosticsStore>;
