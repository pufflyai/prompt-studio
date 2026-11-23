import type { HarnessParams } from "@pstdio/sdk/extensions";
import { afterOpencodePlugins } from "./opencode-catalog-readiness";
import { buildHeaders, buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import { toOpencodeModel } from "./opencode-model";
import type { WithServerUrl } from "./opencode-server";
import { waitForOpencodeIdle } from "./opencode-session-wait";
export const createCommandApi = (deps: {
  fetcher: OpencodeFetcher;
  withServerUrl: WithServerUrl;
  now?: () => number;
}) => {
  const now = deps.now ?? Date.now;
  const loadCommands = (directory: string, signal?: AbortSignal) =>
    deps.withServerUrl(
      (baseUrl) =>
        afterOpencodePlugins({ fetcher: deps.fetcher, baseUrl, directory, signal }, async (readySignal) => {
          const { response, text, parsed } = await requestJson<{ data: Array<{ name: string; description?: string }> }>(
            deps.fetcher,
            buildRequestUrl(baseUrl, "/api/command", directory),
            { method: "GET", headers: buildHeaders(directory), signal: readySignal },
          );
          requireResponseOk(response, text, "OpenCode command discovery failed");
          return (parsed?.data ?? []).map((command) => ({
            name: `/${command.name}`,
            description: command.description ?? "Native OpenCode command",
          }));
        }),
      { retry: true },
    );
  type CommandCatalog = Awaited<ReturnType<typeof loadCommands>>;
  type CommandCache = {
    settled?: { expiresAt: number; value: CommandCatalog };
    pending: Map<AbortSignal | undefined, Promise<CommandCatalog>>;
  };
  const commands = new Map<string, CommandCache>();
  return {
    getCommands: async (cwd?: string, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      const directory = cwd ?? process.cwd();
      const cache: CommandCache = commands.get(directory) ?? { pending: new Map() };
      if (cache.settled && cache.settled.expiresAt > now()) return cache.settled.value;
      const pending = cache.pending.get(signal);
      if (pending) return pending;

      const expiresAt = now() + 30_000;
      const value = loadCommands(directory, signal)
        .then((catalog) => {
          signal?.throwIfAborted();
          if (!cache.settled || cache.settled.expiresAt <= now()) cache.settled = { expiresAt, value: catalog };
          return catalog;
        })
        .finally(() => {
          cache.pending.delete(signal);
          if (
            !cache.pending.size &&
            (!cache.settled || cache.settled.expiresAt <= now()) &&
            commands.get(directory) === cache
          )
            commands.delete(directory);
        });
      cache.pending.set(signal, value);
      commands.set(directory, cache);
      return value;
    },
    runCommand: async (input: CommandInput) => {
      const directory = input.cwd ?? process.cwd();
      await deps.withServerUrl(async (baseUrl) => {
        const { body, compact } = commandRequest(input);
        const model = toOpencodeModel(input.model, input.params);
        if (model) {
          const selection = await requestJson(
            deps.fetcher,
            buildRequestUrl(baseUrl, `/api/session/${input.sessionId}/model`, directory),
            {
              method: "POST",
              headers: buildHeaders(directory),
              body: { model },
              signal: input.signal,
            },
          );
          requireResponseOk(selection.response, selection.text, "OpenCode model selection failed");
        }
        const path = `/api/session/${input.sessionId}/${compact ? "compact" : "command"}`;
        const { response, text } = await requestJson(deps.fetcher, buildRequestUrl(baseUrl, path, directory), {
          method: "POST",
          headers: buildHeaders(directory),
          body,
          signal: input.signal,
        });
        requireResponseOk(response, text, "OpenCode native command failed");
      });
      commands.delete(directory);
      await waitForOpencodeIdle({ ...deps, directory, sessionId: input.sessionId, signal: input.signal });
    },
  };
};

interface CommandInput {
  signal?: AbortSignal;
  sessionId: string;
  text: string;
  model?: string | null;
  params?: HarnessParams;
  cwd?: string;
}
const commandRequest = (input: CommandInput) => {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(input.text);
  if (!match) throw new Error("Enter a native slash command.");
  const compact = match[1] === "compact" || match[1] === "summarize";
  if (compact && match[2]) throw new Error("OpenCode compaction does not accept arguments.");
  return { compact, body: compact ? {} : { name: match[1], text: match[2] ?? "" } };
};
