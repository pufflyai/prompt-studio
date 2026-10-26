import {
  chooseHarnessAuthentication,
  type HarnessAuthentication,
  type HarnessAuthenticationChannel,
  type HarnessAuthenticationInput,
} from "@pstdio/sdk/extensions";
import { type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import { readStoredOpencodeProviders } from "./stored-providers";

type Prompt = {
  type: "text" | "select";
  key: string;
  message: string;
  placeholder?: string;
  options?: { value: string; label: string; hint?: string }[];
  when?: { key: string; op: "eq" | "neq"; value: string };
};
type Method = { type: "oauth" | "api"; label: string; prompts?: Prompt[] };
type Provider = { id: string; name: string; source: string; models: Record<string, unknown> };
type Catalog = { all: Provider[]; connected: string[]; default: Record<string, string> };
interface AuthenticationDeps {
  storedProviders?: () => Promise<string[]>;
  fetcher: OpencodeFetcher;
  withServerUrl: <T>(invoke: (url: string) => Promise<T>) => Promise<T>;
}

const collectInputs = async (native: Method, channel: HarnessAuthenticationChannel) => {
  const inputs: Record<string, string> = {};
  for (const prompt of native.prompts ?? []) {
    if (prompt.when) {
      const equal = inputs[prompt.when.key] === prompt.when.value;
      if ((prompt.when.op === "eq") !== equal) continue;
    }
    inputs[prompt.key] = await channel.request(
      prompt.type === "select"
        ? {
            type: "select",
            title: prompt.message,
            options: (prompt.options ?? []).map((option) => ({
              id: option.value,
              label: option.label,
              description: option.hint,
            })),
          }
        : { type: "input", title: prompt.message, placeholder: prompt.placeholder, secret: true },
    );
  }
  return inputs;
};

export const createOpencodeAuthentication = (deps: AuthenticationDeps) => {
  const request = <T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal) =>
    deps.withServerUrl(async (base) => {
      const response = await requestJson<T>(deps.fetcher, new URL(path, base).href, {
        method,
        body,
        signal,
        headers: { "content-type": "application/json" },
      });
      // Native errors may contain submitted credentials. Keep them within the harness.
      requireResponseOk(response.response, "", "OpenCode account request failed");
      return response.parsed as T;
    });
  const catalog = async () => {
    const [providers, methods, stored] = await Promise.all([
      request<Catalog>("/provider"),
      request<Record<string, Method[]>>("/provider/auth"),
      (deps.storedProviders ?? readStoredOpencodeProviders)(),
    ]);
    return { providers, methods, stored };
  };
  const state = (data: Awaited<ReturnType<typeof catalog>>, model?: string) => {
    const providers = data.providers.all.map((provider) => {
      const connected = data.providers.connected.includes(provider.id);
      let status: HarnessAuthentication["status"] = "signed_out";
      if (connected) status = "signed_in";
      if (connected && provider.source === "custom" && !data.stored.includes(provider.id)) status = "not_required";
      return {
        id: provider.id,
        label: provider.name,
        status,
        canLogout: data.stored.includes(provider.id) && !["env", "config"].includes(provider.source),
        methods: (data.methods[provider.id] ?? [{ type: "api", label: "API key" }]).map((method, index) => ({
          id: String(index),
          label: method.label,
          kind: method.type === "oauth" ? ("oauth" as const) : ("api_key" as const),
        })),
      };
    });
    const provider = model?.split("/")[0];
    return {
      provider,
      status: providers.find((item) => item.id === provider)?.status ?? "unknown",
      providers,
    } satisfies HarnessAuthentication;
  };
  const getAuthentication = async (input: { model?: string } = {}) => state(await catalog(), input.model);
  const authenticate = async (input: HarnessAuthenticationInput, channel: HarnessAuthenticationChannel) => {
    const data = await catalog();
    channel.signal.throwIfAborted();
    const choice = await chooseHarnessAuthentication(state(data, input.model), input, channel);
    if (!choice) return;
    const path = "/auth/" + encodeURIComponent(choice.provider);
    if (input.action === "logout") {
      await request(path, "DELETE", undefined, channel.signal);
      return;
    }
    const method = Number(choice.method);
    const native = data.methods[choice.provider]?.[method] ?? { type: "api", label: "API key" };
    const inputs = await collectInputs(native, channel);
    if (native.type === "api") {
      const key = (await channel.request({ type: "input", title: "API key", secret: true })).trim();
      if (!key) throw new Error("Enter an API key.");
      await request(
        path,
        "PUT",
        { type: "api", key, ...(Object.keys(inputs).length ? { metadata: inputs } : {}) },
        channel.signal,
      );
      return;
    }
    const endpoint = "/provider/" + encodeURIComponent(choice.provider) + "/oauth/";
    const result = await request<{ url: string; method: "auto" | "code"; instructions: string }>(
      endpoint + "authorize",
      "POST",
      { method, inputs },
      channel.signal,
    );
    await channel.emit({ type: "browser", url: result.url, message: result.instructions });
    const code =
      result.method === "code"
        ? await channel.request({
            type: "input",
            title: result.instructions || "Paste the authorization code",
            secret: true,
          })
        : undefined;
    await request(endpoint + "callback", "POST", { method, ...(code ? { code } : {}) }, channel.signal);
  };
  return { getAuthentication, authenticate };
};
