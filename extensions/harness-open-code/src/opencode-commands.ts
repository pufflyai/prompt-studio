import { buildHeaders, buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import { waitForOpencodeIdle } from "./opencode-session-wait";
export const createCommandApi = (deps: {
  fetcher: OpencodeFetcher;
  withServerUrl: <T>(fn: (url: string) => Promise<T>) => Promise<T>;
  now?: () => number;
}) => {
  const now = deps.now ?? Date.now;
  const loadCommands = (directory: string) =>
    deps.withServerUrl(async (baseUrl) => {
      // OpenCode's command catalog does not await location plugins. See ADR 0135.
      const ready = await requestJson(deps.fetcher, buildRequestUrl(baseUrl, "/api/provider", directory), {
        method: "GET",
        headers: buildHeaders(directory),
      });
      requireResponseOk(ready.response, "", "OpenCode command initialization failed");
      const { response, text, parsed } = await requestJson<{ data: Array<{ name: string; description?: string }> }>(
        deps.fetcher,
        buildRequestUrl(baseUrl, "/api/command", directory),
        { method: "GET", headers: buildHeaders(directory) },
      );
      requireResponseOk(response, text, "OpenCode command discovery failed");
      return (parsed?.data ?? []).map((command) => ({
        name: `/${command.name}`,
        description: command.description ?? "Native OpenCode command",
      }));
    });
  const commands = new Map<string, { expiresAt: number; value: ReturnType<typeof loadCommands> }>();
  return {
    getCommands: (cwd?: string) => {
      const directory = cwd ?? process.cwd();
      const cached = commands.get(directory);
      if (cached && cached.expiresAt > now()) return cached.value;
      const value = loadCommands(directory).catch((error: unknown) => {
        if (commands.get(directory)?.value === value) commands.delete(directory);
        throw error;
      });
      commands.set(directory, { expiresAt: now() + 30_000, value });
      return value;
    },
    runCommand: async (input: CommandInput) => {
      const directory = input.cwd ?? process.cwd();
      await deps.withServerUrl(async (baseUrl) => {
        const { body, compact } = commandRequest(input);
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
  cwd?: string;
}
const commandRequest = (input: CommandInput) => {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(input.text);
  if (!match) throw new Error("Enter a native slash command.");
  const compact = match[1] === "compact" || match[1] === "summarize";
  if (compact && match[2]) throw new Error("OpenCode compaction does not accept arguments.");
  return { compact, body: compact ? {} : { name: match[1], text: match[2] ?? "" } };
};
