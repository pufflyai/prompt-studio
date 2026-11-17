import {
  createWebviewClient,
  type GuestHost,
  type PropsStore,
  type WebviewCommandEditingSession,
  type WebviewEditingChange,
} from "@pstdio/sdk/extensions";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { ExampleProps } from "../../view-context";
import type { MarmaladeAction, MarmaladeViewState } from "./marmalade.types";
import { createMarmaladeState } from "./marmalade-data";
import { applyMarmaladeAction } from "./marmalade-document";
import { type MarmaladeEditingState, marmaladeEditingChanges, marmaladeEditingView } from "./marmalade-editing-state";
import { marmaladeChanged } from "./marmalade-events";
import { isMarmaladePresentationAction } from "./marmalade-presentation";

const initial = (): MarmaladeViewState => ({ ...createMarmaladeState(), history: { undo: 0, redo: 0, boundary: "" } });
const supportsPreview = (action: MarmaladeAction) =>
  !["undo", "redo", "create", "duplicate", "delete", "group", "ungroup", "reorder", "empty", "reset"].includes(
    action.type,
  );
const optimistic = (state: MarmaladeViewState, action: MarmaladeAction) => {
  if (!supportsPreview(action)) return [];
  return marmaladeEditingChanges(state, { ...state, ...applyMarmaladeAction(state, action) });
};
const identity = (props: ExampleProps) =>
  `${props.projectId ?? ""}:${props.resource?.id ?? props.pageLocation?.resource?.id ?? "great-wave"}`;

/** UI projection only. The host command session owns the document, drafts and required writes. */
export const createMarmaladeStore = () => {
  const projection = createStore(() => ({
    state: initial(),
    error: "",
    ready: false,
    hasDrafts: false,
    pendingCommands: 0,
  }));
  let session: WebviewCommandEditingSession<MarmaladeEditingState> | undefined;
  let gesture:
    | {
        base: MarmaladeViewState;
        action: MarmaladeAction;
        changes: WebviewEditingChange[];
        completion: "gesture" | "defocus";
      }
    | undefined;
  let reopen = async () => {};
  const failure = (error: unknown) =>
    projection.setState({ error: error instanceof Error ? error.message : String(error) });
  const prepare = (action: MarmaladeAction): MarmaladeAction =>
    action.type === "create" && !action.id ? { ...action, id: crypto.randomUUID() } : action;
  const execute = async (action: MarmaladeAction, changes: WebviewEditingChange[], historyBoundary?: string) => {
    const captured = session;
    if (!captured) return;
    try {
      projection.setState({ error: "" });
      await captured.execute(
        { action: JSON.parse(JSON.stringify(action)), ...(historyBoundary !== undefined && { historyBoundary }) },
        {
          changes,
          channel: isMarmaladePresentationAction(action) ? "presentation" : "document",
        },
      );
    } catch (error) {
      if (session === captured) failure(error);
    }
  };
  const cancelPreview = async () => {
    gesture = undefined;
    const captured = session;
    try {
      await captured?.cancel();
    } catch (error) {
      if (session === captured) failure(error);
    }
  };
  const commitPreview = async () => {
    const current = gesture;
    gesture = undefined;
    if (current)
      await execute(
        current.action,
        current.changes,
        isMarmaladePresentationAction(current.action) ? undefined : current.base.history.boundary,
      );
  };
  const finishProperty = () => (gesture?.completion === "defocus" ? commitPreview() : Promise.resolve());
  return {
    getSnapshot: projection.getState,
    subscribe: projection.subscribe,
    getGestureBoundary: () => ({ owner: session, history: projection.getState().state.history.boundary }),
    async dispatch(input: MarmaladeAction, boundary?: { owner: unknown; history: string }) {
      if (boundary && (boundary.owner !== session || boundary.history !== projection.getState().state.history.boundary))
        return;
      const history = input.type === "undo" || input.type === "redo";
      const documentGesture = gesture && !isMarmaladePresentationAction(gesture.action);
      const completedGesture = history && documentGesture ? cancelPreview() : commitPreview();
      const action = prepare(input);
      try {
        // Cancelling clears local preview intent synchronously; admit required work before a view can retire.
        const submitted = execute(action, optimistic(projection.getState().state, action), boundary?.history);
        await Promise.all([completedGesture, submitted]);
      } catch (error) {
        failure(error);
      }
    },
    async preview(input: MarmaladeAction, completion: "gesture" | "defocus" = "gesture") {
      const captured = session;
      if (!captured || !supportsPreview(input)) return;
      try {
        const base = gesture?.base ?? projection.getState().state;
        const action = input;
        const changes = marmaladeEditingChanges(
          base,
          { ...base, ...applyMarmaladeAction(base, action) },
          gesture?.changes,
        );
        gesture = { base, action, changes, completion };
        await captured.preview(changes);
      } catch (error) {
        if (session === captured) failure(error);
      }
    },
    commitPreview,
    cancelPreview,
    async retry() {
      const current = session;
      try {
        if (current) await current.save();
        else await reopen();
      } catch (error) {
        if (session === current) failure(error);
      }
    },
    connect(
      host: GuestHost,
      props: PropsStore<ExampleProps>,
      onError: (error: unknown) => void,
      onReady?: (ready?: boolean) => void,
    ) {
      const client = createWebviewClient(host);
      let active = true;
      let generation = 0;
      let scope = "";
      let stopSession = () => {};
      const open = async () => {
        const ownGeneration = ++generation;
        const previousScope = scope;
        scope = identity(props.get());
        try {
          const completedProperty = finishProperty();
          stopSession();
          const previous = session;
          session = undefined;
          gesture = undefined;
          projection.setState({ state: initial(), error: "", ready: false, hasDrafts: false, pendingCommands: 0 });
          onReady?.(false);
          void completedProperty
            .then(() => previous?.close())
            .catch((error) => {
              if (active && generation === ownGeneration && previousScope === scope) onError(error);
            });
          const documentId = props.get().resource?.id ?? props.get().pageLocation?.resource?.id ?? "great-wave";
          const opened = await client.editing.openCommand<MarmaladeEditingState>({
            key: `marmalade:${documentId}`,
            read: { commandId: `${host.extensionId}.command.marmalade.session.read` },
            command: { commandId: `${host.extensionId}.command.marmalade.session.execute` },
            dependsOn: [marmaladeChanged],
          });
          if (!active || generation !== ownGeneration) return opened.close();
          session = opened;
          const publish = () => {
            if (!active || session !== opened) return;
            const next = opened.getSnapshot();
            if (next.retired) {
              projection.setState({ state: initial(), ready: false, error: "", hasDrafts: false, pendingCommands: 0 });
              session = undefined;
              gesture = undefined;
              onReady?.(false);
              return;
            }
            if (
              gesture &&
              !isMarmaladePresentationAction(gesture.action) &&
              gesture.base.history.boundary !== next.value.history.boundary
            )
              void cancelPreview();
            projection.setState({
              state: marmaladeEditingView(next.value),
              ready: true,
              error: next.error?.message ?? "",
              hasDrafts: next.hasDrafts ?? false,
              pendingCommands: next.pendingCommands ?? 0,
            });
          };
          stopSession = opened.subscribe(publish);
          publish();
          onReady?.();
        } catch (error) {
          if (active && generation === ownGeneration) {
            failure(error);
            onError(error);
          }
        }
      };
      reopen = open;
      const stopProps = props.subscribe((next) => {
        if (active && scope !== identity(next)) void open().catch(onError);
      });
      void open().catch(onError);
      return () => {
        if (!active) return;
        active = false;
        generation++;
        stopProps();
        const completedProperty = finishProperty();
        stopSession();
        const current = session;
        session = undefined;
        gesture = undefined;
        projection.setState({ state: initial(), ready: false, error: "", hasDrafts: false, pendingCommands: 0 });
        reopen = async () => {};
        // Defocus completes property input. Pointer gestures cancel; accepted commands retain their owner.
        void completedProperty.then(() => current?.close()).catch(onError);
      };
    },
  };
};
export const marmaladeStore = createMarmaladeStore();
const initialProjection = marmaladeStore.getSnapshot();
const ui = {
  getState: marmaladeStore.getSnapshot,
  getInitialState: () => initialProjection,
  subscribe: marmaladeStore.subscribe,
};
export const useMarmalade = <Selected>(selector: (state: typeof initialProjection) => Selected) =>
  useStore(ui, selector);
