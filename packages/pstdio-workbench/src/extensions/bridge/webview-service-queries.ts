import type { ScopedQuery } from "@pstdio/sdk/extensions";
import type { WebviewServiceQueryDefinition, WebviewServiceQueryRequest } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";
import { getWebviewCommandQueryContext } from "./webview-command-query-context";
import { serveWebviewQuery } from "./webview-query-members";
import { getWebviewQuerySource } from "./webview-query-source";

/** Presentation bridges reuse canonical service owners; they never create a second domain cache. */
export const createWebviewServiceQueryAdapter = <Definition extends WebviewServiceQueryDefinition>(input: {
  channel: "account.query" | "performance.query" | "preferences.query";
  owner: string;
  events: HostEventPublisher;
  workbench?: WorkbenchCore;
  projectId?: string;
  requireCurrent(): void;
  sources(): readonly { source: Definition; query: ScopedQuery<unknown> }[];
  source(definition: Definition): ScopedQuery<unknown>;
}) => {
  const context = input.workbench ? getWebviewCommandQueryContext(input.workbench) : undefined;
  const requireCurrent = () => {
    context?.assertCurrent(input.projectId);
    input.requireCurrent();
  };
  return {
    seeds: () => {
      try {
        requireCurrent();
      } catch {
        return { owner: input.owner, values: [] };
      }
      return {
        owner: input.owner,
        values: input
          .sources()
          .filter((value) => !value.query.isDisposed())
          .map((value) => ({ source: value.source, snapshot: getWebviewQuerySource(value.query).snapshot() })),
      };
    },
    request: (request: WebviewServiceQueryRequest<Definition>) =>
      serveWebviewQuery({
        ...input,
        request,
        requireCurrent,
        subscribeClose: (close) => context?.subscribeClose(close) ?? (() => {}),
        source: () => {
          if (request.operation === "close") throw new Error("Service query is closed");
          return getWebviewQuerySource(input.source(request.source));
        },
      }),
  };
};
