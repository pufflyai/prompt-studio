import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { WebviewDescriptor } from "../layout/layout-model";

export interface WebviewContribution extends WebviewDescriptor {
  id: string;
}

export interface RegisteredWebviewContribution extends WebviewContribution, RegisteredContributionMetadata {}

export const createWebviewRegistry = () => {
  const webviews = new Map<string, RegisteredWebviewContribution>();

  return {
    registerWebview(webview: WebviewContribution, metadata?: ContributionMetadata) {
      if (webviews.has(webview.id)) throw new Error(`Webview already registered: ${webview.id}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...webview,
      };

      webviews.set(webview.id, record);

      return createDisposable(() => {
        if (webviews.get(webview.id) === record) webviews.delete(webview.id);
      });
    },

    getWebview(id: string) {
      return webviews.get(id);
    },

    listWebviews() {
      return [...webviews.values()].sort(byContributionPriority);
    },
  };
};

export type WebviewRegistry = ReturnType<typeof createWebviewRegistry>;
