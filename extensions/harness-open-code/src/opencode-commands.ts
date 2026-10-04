import { buildHeaders, buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
export const createCommandApi = (deps: {
  fetcher: OpencodeFetcher;
  withServerUrl: <T>(fn: (url: string) => Promise<T>) => Promise<T>;
}) => ({
  getCommands: (cwd?: string) =>
    deps.withServerUrl(async (baseUrl) => {
      const directory = cwd ?? process.cwd();
      const { response, text, parsed } = await requestJson<Array<{ name: string; description?: string }>>(
        deps.fetcher,
        buildRequestUrl(baseUrl, "/command", directory),
        { method: "GET", headers: buildHeaders(directory) },
      );
      requireResponseOk(response, text, "OpenCode command discovery failed");
      return (parsed ?? []).map((command) => ({
        name: `/${command.name}`,
        description: command.description ?? "Native OpenCode command",
      }));
    }),
  runCommand: (input: CommandInput) =>
    deps.withServerUrl(async (baseUrl) => {
      const body = commandRequest(input);
      const compact = "auto" in body;
      const directory = input.cwd ?? process.cwd();
      const path = `/session/${input.sessionId}/${compact ? "summarize" : "command"}`;
      const { response, text } = await requestJson(deps.fetcher, buildRequestUrl(baseUrl, path, directory), {
        method: "POST",
        headers: buildHeaders(directory),
        body,
        signal: input.signal,
      });
      requireResponseOk(response, text, "OpenCode native command failed");
      if (compact && JSON.parse(text) !== true) throw new Error("OpenCode did not complete compaction.");
    }),
});

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
  const model = input.model?.split("/");
  if (compact && (!model || model.length < 2)) throw new Error("Select a model before compacting the conversation.");
  if (compact && match[2]) throw new Error("OpenCode compaction does not accept arguments.");
  return compact
    ? { providerID: model?.[0], modelID: model?.slice(1).join("/"), auto: false }
    : { command: match[1], arguments: match[2] ?? "", ...(input.model ? { model: input.model } : {}) };
};
