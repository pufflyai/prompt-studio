import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, type WorkbenchLayout, type WorkbenchTabSnapshot } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../../extensions/contributions/extension-contributions";
import { createWorkbenchExtensionTabPresentation } from "../../extensions/host/workbench-extension-tab-presentation";
import { usePlacementTab } from "./use-placement-tab";
import { useWorkbenchStore } from "./use-workbench-store";

test.each([
  "snapshot",
  "project scope",
])("%s restoration reconnects a retained tab to its live metadata provider", async (path) => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const workbench = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => layouts.get(scope),
      setLayout: (layout, scope) => void layouts.set(scope, layout),
    },
  });
  const queries = createScopedQueryClient({
    runtimeId: "tab-restoration",
    projectId: "project",
    extensionId: "sessions",
  });
  const held = Promise.withResolvers<unknown>();
  const signals: AbortSignal[] = [];
  let reads = 0;
  const createTab = (executeCommand: (signal: AbortSignal) => Promise<unknown>) =>
    createWorkbenchExtensionTabPresentation(
      {
        workbench,
        projectId: "project",
        queries,
        metadata: emptyWorkbenchExtensionMetadata,
        executeCommand: (_command, _input, signal) => executeCommand(signal!),
      },
      { extensionId: "sessions", placementId: "conversation", queryHandlerId: "conversation.tab" },
    );
  const old = createTab(async (signal) => {
    signals.push(signal);
    return held.promise;
  });
  const register = (tab: typeof old) =>
    workbench.layout.registerPanel({ id: "conversation", title: "Session", rendererId: "chat", region: "side", tab });
  let registration = register(old);
  workbench.layout.openPanel("conversation", { resource: { type: "session-draft", id: "first" } });
  let shown: WorkbenchTabSnapshot = {};
  const Capture = () => {
    const placement = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.side.widgets[0]);
    shown = usePlacementTab(placement, workbench);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  let current: typeof old | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture />);
    });
    const snapshot = workbench.layout.getLayout();
    await act(async () => {
      registration.dispose();
      old.dispose();
      current = createTab(async () => {
        reads++;
        return { label: "Session", menu: [{ id: "sessions", rows: [{ id: "new", label: "New session" }] }] };
      });
      registration = register(current);
      if (path === "snapshot") workbench.layout.restoreLayout(snapshot);
      else {
        layouts.set("returning-project", snapshot);
        workbench.layout.setPersistenceScope("returning-project");
      }
      held.resolve({ label: "Obsolete title" });
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(signals[0].aborted).toBe(true);
    expect(shown.menu?.[0]?.rows[0]?.label).toBe("New session");
    expect(reads).toBe(1);
    const acceptedReads = signals.length;
    old.getSnapshot(workbench.layout.getActivePanel("side")!);
    expect(signals).toHaveLength(acceptedReads);
  } finally {
    held.resolve({});
    await act(async () => renderer?.unmount());
    registration.dispose();
    current?.dispose();
    old.dispose();
    queries.dispose();
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
