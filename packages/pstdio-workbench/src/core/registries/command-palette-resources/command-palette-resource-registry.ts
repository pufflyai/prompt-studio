import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface CommandPaletteResourceQueryContext {
  query: string;
  limit: number;
}

// A single dynamic palette result. `activate` is supplied by whoever registers the
// provider (e.g. the extension host running a command or opening a resource), keeping
// this registry free of command/resource execution concerns.
export interface CommandPaletteResourceResult {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  group?: string;
  activate(): void | Promise<void>;
}

export interface CommandPaletteResourceProvider {
  id: string;
  title: string;
  refreshEventIds?: string[];
  query(context: CommandPaletteResourceQueryContext): Promise<readonly CommandPaletteResourceResult[]>;
}

export interface CommandPaletteResourceProviderResult {
  providerId: string;
  title: string;
  results: readonly CommandPaletteResourceResult[];
}

export interface CommandPaletteResourceRegistryStoreState {
  providers: Record<string, CommandPaletteResourceProvider>;
  // Bumped to ask the palette to re-query providers (e.g. after a refresh event).
  refreshToken: number;
}

export interface CommandPaletteResourceRegistry {
  store: WorkbenchStore<CommandPaletteResourceRegistryStoreState>;
  registerProvider(provider: CommandPaletteResourceProvider): Disposable;
  listProviders(): CommandPaletteResourceProvider[];
  queryProviders(context: CommandPaletteResourceQueryContext): Promise<CommandPaletteResourceProviderResult[]>;
  refresh(): void;
}

export const createCommandPaletteResourceRegistry = (): CommandPaletteResourceRegistry => {
  const store = createWorkbenchStore<CommandPaletteResourceRegistryStoreState>({
    name: "workbench.commandPaletteResources",
    initialState: { providers: {}, refreshToken: 0 },
  });

  return {
    store,

    registerProvider(provider) {
      const snapshot = store.getState();
      if (snapshot.providers[provider.id]) {
        throw new Error(`Command palette resource provider already registered: ${provider.id}`);
      }

      store.setState(
        { ...snapshot, providers: { ...snapshot.providers, [provider.id]: provider } },
        false,
        "registerProvider",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.providers[provider.id] !== provider) return;
        const { [provider.id]: _removed, ...rest } = current.providers;
        store.setState({ ...current, providers: rest }, false, "unregisterProvider");
      });
    },

    listProviders() {
      return Object.values(store.getState().providers);
    },

    async queryProviders(context) {
      const providers = Object.values(store.getState().providers);
      return Promise.all(
        providers.map(async (provider) => {
          try {
            const results = await provider.query(context);
            return { providerId: provider.id, title: provider.title, results };
          } catch {
            // Error isolation: a failing provider must not blank the palette or break peers.
            return { providerId: provider.id, title: provider.title, results: [] };
          }
        }),
      );
    },

    refresh() {
      const snapshot = store.getState();
      store.setState({ ...snapshot, refreshToken: snapshot.refreshToken + 1 }, false, "refresh");
    },
  };
};
