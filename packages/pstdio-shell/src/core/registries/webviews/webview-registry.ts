import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";
import type { WebviewDescriptor } from "../layout/layout-model";

export interface WebviewContribution extends WebviewDescriptor {
  id: string;
}

export interface RegisteredWebviewContribution extends WebviewContribution, RegisteredContributionMetadata {}

export interface WebviewRegistryStoreState {
  webviews: Record<string, RegisteredWebviewContribution>;
}

export interface WebviewRegistry {
  store: ShellStore<WebviewRegistryStoreState>;
  registerWebview(webview: WebviewContribution, metadata?: ContributionMetadata): Disposable;
  getWebview(id: string): RegisteredWebviewContribution | undefined;
  listWebviews(): RegisteredWebviewContribution[];
}

export const createWebviewRegistry = (): WebviewRegistry => {
  const store = createShellStore<WebviewRegistryStoreState>({
    name: "shell.webviews",
    initialState: { webviews: {} },
  });

  return {
    store,

    registerWebview(webview, metadata) {
      const snapshot = store.getState();
      if (snapshot.webviews[webview.id]) throw new Error(`Webview already registered: ${webview.id}`);

      const record: RegisteredWebviewContribution = {
        ...normalizeContributionMetadata(metadata),
        ...webview,
      };

      store.setState({ webviews: { ...snapshot.webviews, [webview.id]: record } }, false, "registerWebview");

      return createDisposable(() => {
        const current = store.getState();
        if (current.webviews[webview.id] !== record) return;
        const { [webview.id]: _removed, ...rest } = current.webviews;
        store.setState({ webviews: rest }, false, "unregisterWebview");
      });
    },

    getWebview(id) {
      return store.getState().webviews[id];
    },

    listWebviews() {
      return Object.values(store.getState().webviews).sort(byContributionPriority);
    },
  };
};
