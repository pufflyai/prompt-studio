import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

// `render` returns `unknown` (not `ReactNode`) so the core stays React-free;
// the React layer casts it back when portaling into the host.
export interface KeepAliveRegistration {
  id: string;
  render(): unknown;
  onAttach?(host: HTMLElement): void;
  onDetach?(host: HTMLElement): void;
  onDispose?(): void;
}

export interface RegisteredKeepAlive extends RegisteredContributionMetadata {
  id: string;
  render(): unknown;
  host: HTMLElement;
  onAttach?(host: HTMLElement): void;
  onDetach?(host: HTMLElement): void;
  onDispose?(): void;
}

export interface KeepAliveHostState {
  id: string;
  host: HTMLElement;
  attachedTo?: HTMLElement;
}

export interface KeepAliveStoreState {
  registrations: Record<string, RegisteredKeepAlive>;
  hosts: Record<string, KeepAliveHostState>;
}

export interface KeepAliveController {
  store: WorkbenchStore<KeepAliveStoreState>;
  register(registration: KeepAliveRegistration, metadata?: ContributionMetadata): Disposable;
  claim(id: string, slot: HTMLElement): Disposable;
  listRegistrations(): readonly RegisteredKeepAlive[];
  getHost(id: string): HTMLElement | undefined;
  getAttachedSlot(id: string): HTMLElement | undefined;
}

export interface CreateKeepAliveControllerInput {
  // Override for environments without a real DOM (Bun tests). Default reads
  // `document` via lazy import; SSR callers without DOM should provide their own.
  createHost?: () => HTMLElement;
}

// Renderer id of the built-in widget body that adopts a kept-alive subtree
// into its area. Bridge widgets reference it as their `rendererId`.
export const WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID = "workbench.keep-alive-slot";

export interface WorkbenchKeepAliveSlotConfig {
  keepAliveId: string;
}

const removeKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _removed, ...rest } = record;
  return rest;
};

const defaultCreateHost = (): HTMLElement => {
  if (typeof document === "undefined") {
    throw new Error(
      "workbench.keepAlive.register: no DOM available. The default host factory uses document.createElement. " +
        "In a non-browser environment (Bun tests, SSR), pass a custom factory via " +
        "createWorkbenchCore({ keepAlive: { createHost: () => myHost } }).",
    );
  }
  const host = document.createElement("div");
  host.style.display = "contents";
  host.dataset.workbenchKeepAliveHost = "";
  return host;
};

export const createKeepAliveController = (input: CreateKeepAliveControllerInput = {}): KeepAliveController => {
  const createHost = input.createHost ?? defaultCreateHost;

  const store = createWorkbenchStore<KeepAliveStoreState>({
    name: "workbench.keepAlive",
    initialState: { registrations: {}, hosts: {} },
  });

  // Detach the host of `id` from its current slot (if any) and fire onDetach.
  // Used by `claim` before re-parenting, and by dispose before unmount.
  const detachHost = (id: string) => {
    const snapshot = store.getState();
    const hostState = snapshot.hosts[id];
    const registration = snapshot.registrations[id];
    const previousSlot = hostState?.attachedTo;
    if (!hostState || !previousSlot) return;

    if (previousSlot.contains(hostState.host)) previousSlot.removeChild(hostState.host);
    registration?.onDetach?.(hostState.host);

    store.setState(
      { ...snapshot, hosts: { ...snapshot.hosts, [id]: { ...hostState, attachedTo: undefined } } },
      false,
      "keepAlive.detach",
    );
  };

  return {
    store,

    register(registration, metadata) {
      const snapshot = store.getState();
      if (snapshot.registrations[registration.id]) {
        throw new Error(`Keep-alive id already registered: ${registration.id}`);
      }

      const host = createHost();
      const record: RegisteredKeepAlive = {
        id: registration.id,
        render: registration.render,
        host,
        onAttach: registration.onAttach,
        onDetach: registration.onDetach,
        onDispose: registration.onDispose,
        ...normalizeContributionMetadata(metadata),
      };

      store.setState(
        {
          registrations: { ...snapshot.registrations, [registration.id]: record },
          hosts: { ...snapshot.hosts, [registration.id]: { id: registration.id, host } },
        },
        false,
        "keepAlive.register",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.registrations[registration.id] !== record) return;

        detachHost(registration.id);
        record.onDispose?.();

        const after = store.getState();
        store.setState(
          {
            registrations: removeKey(after.registrations, registration.id),
            hosts: removeKey(after.hosts, registration.id),
          },
          false,
          "keepAlive.unregister",
        );
      });
    },

    claim(id, slot) {
      const snapshot = store.getState();
      const registration = snapshot.registrations[id];
      if (!registration) throw new Error(`Keep-alive id not registered: ${id}`);

      // Detach from any previous slot so a single registration only ever has one parent.
      detachHost(id);

      const next = store.getState();
      const hostState = next.hosts[id]!;
      slot.appendChild(hostState.host);
      registration.onAttach?.(hostState.host);

      store.setState(
        { ...next, hosts: { ...next.hosts, [id]: { ...hostState, attachedTo: slot } } },
        false,
        "keepAlive.attach",
      );

      return createDisposable(() => {
        const current = store.getState();
        const currentHostState = current.hosts[id];
        if (!currentHostState || currentHostState.attachedTo !== slot) return;
        detachHost(id);
      });
    },

    listRegistrations() {
      return Object.values(store.getState().registrations);
    },

    getHost(id) {
      return store.getState().hosts[id]?.host;
    },

    getAttachedSlot(id) {
      return store.getState().hosts[id]?.attachedTo;
    },
  };
};
