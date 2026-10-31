import type { TextEditingConnection, TextEditingConnectionInput, TextEditingTransportClient } from "@pstdio/sdk/client";
import type { TextEditingRequest } from "@pstdio/sdk/extensions";
import { createNativeDocumentKey } from "pstdio-api-contracts";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { registerPlacementCloseGuard } from "../controllers/composition/placement-close-guards";
import type { WorkbenchPanelInstance } from "../registries/layout/layout-model";
import type { WorkbenchCore } from "../workbench-core-types";

type Guest = ReturnType<TextEditingConnection["guest"]>;
type Scope = Extract<TextEditingConnectionInput, { kind: "placement" }>;
interface Owner {
  events: HostEventPublisher;
  connection: Promise<TextEditingConnection>;
  guest: Promise<Guest>;
  current(scope?: Scope): boolean;
  detach(): void;
  close(): Promise<void>;
}
interface Ownership {
  live: Map<HostEventPublisher, Owner>;
  retiring: Set<Owner>;
  disposal?: Promise<void>;
}
const ownership = new WeakMap<WorkbenchCore, Ownership>();
const closed = () =>
  Object.assign(new Error("This text view is no longer open"), { code: "session_closed", retryable: false });

export interface PlacementTextGuestInput {
  workbench: WorkbenchCore;
  placement: WorkbenchPanelInstance;
  projectId: string;
  scope: Scope;
  transport: TextEditingTransportClient;
  events: HostEventPublisher;
  /** Native SDK sessions drain before their enclosing guest connection is released. */
  prepareSessionClose?: () => Promise<void>;
}
const scopeKey = (scope: Scope) =>
  JSON.stringify([scope.viewId, scope.target && createNativeDocumentKey(scope.target)]);
const getOwnership = (workbench: WorkbenchCore) => {
  let state = ownership.get(workbench);
  if (!state) {
    state = { live: new Map(), retiring: new Set() };
    ownership.set(workbench, state);
  }
  return state;
};

const retire = async (state: Ownership, owner: Owner) => {
  state.retiring.add(owner);
  owner.detach();
  const connection = await owner.connection.catch(() => undefined);
  if (connection) await connection.disconnect();
  state.retiring.delete(owner);
};

const createOwner = (input: PlacementTextGuestInput, state: Ownership) => {
  const { workbench, placement, projectId, events } = input;
  const invocation = workbench.viewers.captureContext(placement.placementIdentity);
  const selectedScope = scopeKey(input.scope);
  const cleanups: (() => void)[] = [];
  const report = workbench.notifications.captureActionError("Close text editor", placement.instanceId);
  const assertCurrent = () => {
    if (!owner.current()) throw closed();
  };
  const connection = Promise.resolve()
    .then(() => {
      assertCurrent();
      return input.transport.connect({ projectId, scope: input.scope });
    })
    .catch((error) => {
      owner.detach();
      throw error;
    });
  const owner: Owner = {
    events,
    connection,
    current: (scope = input.scope) =>
      scopeKey(scope) === selectedScope &&
      state.live.get(events) === owner &&
      workbench.pages.store.getState().projectId === projectId &&
      invocation.isViewerCurrent?.() !== false,
    guest: connection.then(async (connection) => {
      try {
        assertCurrent();
      } catch (error) {
        await retire(state, owner);
        throw error;
      }
      const guest = connection.guest();
      cleanups.push(
        guest.host.onEvent("editing.text", (event) => events.emit({ scope: "editing.text", payload: event })),
      );
      return guest;
    }),
    detach() {
      if (state.live.get(events) === owner) state.live.delete(events);
      for (const stop of cleanups.splice(0)) stop();
    },
    async close() {
      await input.prepareSessionClose?.();
      const guest = await owner.guest;
      await guest.close();
      owner.detach();
    },
  };
  state.live.set(events, owner);
  cleanups.push(
    events.onDisconnect(() => {
      // Losing a browsing context revokes admission; the host still owns admitted durability.
      void retire(state, owner).catch(report);
    }),
  );
  if (placement.placementIdentity)
    cleanups.push(registerPlacementCloseGuard(workbench, placement.placementIdentity, () => owner.close()));
  return owner;
};

/** One public guest belongs to one live presentation, including while its connection opens. */
const placementTextOwner = (input: PlacementTextGuestInput) => {
  const state = getOwnership(input.workbench);
  // Failed forced cleanup stays owned. A later request or Workbench disposal retries it.
  for (const owner of state.retiring)
    void retire(state, owner).catch(input.workbench.notifications.captureActionError("Close text editor"));
  let owner = state.live.get(input.events);
  if (owner && !owner.current(input.scope)) {
    void retire(state, owner).catch(input.workbench.notifications.captureActionError("Close text editor"));
    owner = undefined;
  }
  if (!owner) {
    if (state.disposal) throw closed();
    owner = createOwner(input, state);
  }
  return owner;
};

export const requestPlacementText = async <Request extends TextEditingRequest>(
  input: PlacementTextGuestInput,
  request: Request,
) => {
  const owner = placementTextOwner(input);
  const guest = await owner.guest;
  if (!owner.current(input.scope)) throw closed();
  return guest.host.call("editing.text", request);
};

/** Failed native admission is drained before a fresh public session is requested. */
export const releasePlacementTextGuest = async (workbench: WorkbenchCore, events: HostEventPublisher) => {
  const state = getOwnership(workbench);
  const live = state.live.get(events);
  const owners = new Set(state.retiring);
  if (live) owners.add(live);
  for (const owner of owners) if (owner.events === events) await retire(state, owner);
};

export const disposePlacementTextGuests = (workbench: WorkbenchCore) => {
  const state = getOwnership(workbench);
  state.disposal ??= Promise.resolve()
    .then(async () => {
      await Promise.all([...state.live.values()].map((owner) => owner.close()));
      await Promise.all([...state.retiring].map((owner) => retire(state, owner)));
    })
    .catch((error) => {
      state.disposal = undefined;
      throw error;
    });
  return state.disposal;
};
