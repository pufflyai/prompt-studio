import type { FormValue, IntegrationInfo, IntegrationMethod, ProviderInfo } from "@opencode/client";
import {
  chooseHarnessAuthentication,
  type HarnessAuthentication,
  type HarnessAuthenticationChannel,
  type HarnessAuthenticationInput,
} from "@pstdio/sdk/extensions";
import { collectFormAnswers } from "./opencode-forms";
import { buildRequestUrl, type OpencodeFetcher, requestJson, requireResponseOk } from "./opencode-http";
import { waitForNextPoll } from "./opencode-session-poller";

interface AuthenticationDeps {
  fetcher: OpencodeFetcher;
  withServerUrl: <T>(invoke: (url: string) => Promise<T>) => Promise<T>;
}
const methodId = (method: IntegrationMethod) => ("id" in method ? method.id : method.type);
const interactiveMethods = (integration?: IntegrationInfo) =>
  integration?.methods.filter((method) => method.type !== "env") ?? [];

export const createOpencodeAuthentication = (deps: AuthenticationDeps) => {
  const request = <T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal) =>
    deps.withServerUrl(async (base) => {
      const response = await requestJson<T>(deps.fetcher, buildRequestUrl(base, path, process.cwd()), {
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
    const [providers, integrations] = await Promise.all([
      request<{ data: ProviderInfo[] }>("/api/provider"),
      request<{ data: IntegrationInfo[] }>("/api/integration"),
    ]);
    return { providers: providers.data, integrations: integrations.data };
  };
  const state = (data: Awaited<ReturnType<typeof catalog>>, model?: string) => {
    const providers = data.providers.map((provider) => {
      const integration = data.integrations.find((item) => item.id === provider.integrationID);
      const connections = integration?.connections ?? [];
      const connected = connections.length > 0 && !connections[0]!.status;
      let status: HarnessAuthentication["status"] = integration ? "signed_out" : "not_required";
      if (!connections.length && provider.activation === "enabled") status = "not_required";
      if (connected) status = "signed_in";
      return {
        id: provider.id,
        label: provider.name,
        status,
        canLogout: connections.some((connection) => connection.type === "credential"),
        methods: interactiveMethods(integration).map((method) => ({
          id: methodId(method),
          label: method.label ?? "API key",
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
  const connectAttempt = async (
    endpoint: string,
    native: Extract<IntegrationMethod, { type: "oauth" | "command" }>,
    answer: Record<string, FormValue>,
    channel: HarnessAuthenticationChannel,
  ) => {
    const kind = native.type;
    const { data: attempt } = await request<{
      data: { attemptID: string; url?: string; instructions?: string; mode?: string };
    }>(endpoint + kind, "POST", { methodID: native.id, answer }, channel.signal);
    const path = `${endpoint + kind}/${encodeURIComponent(attempt.attemptID)}`;
    let lastMessage: string | undefined;
    try {
      if (attempt.url) await channel.emit({ type: "browser", url: attempt.url, message: attempt.instructions });
      if (attempt.mode === "code") {
        const code = await channel.request({
          type: "input",
          title: attempt.instructions || "Paste the authorization code",
          secret: true,
        });
        await request(`${path}/complete`, "POST", { code }, channel.signal);
      }
      while (true) {
        channel.signal.throwIfAborted();
        const result = await request<{ data: { status: string; message?: string } }>(
          path,
          "GET",
          undefined,
          channel.signal,
        );
        if (result.data.status === "complete") return;
        if (result.data.message && result.data.message !== lastMessage) {
          lastMessage = result.data.message;
          await channel.emit({ type: "message", message: lastMessage });
        }
        if (result.data.status !== "pending")
          throw new Error("OpenCode sign-in did not complete. Start sign-in again.");
        await waitForNextPoll(channel.signal, 1000);
      }
    } finally {
      // Cancellation releases native callback listeners even when a shared process stays alive.
      await request(path, "DELETE").catch(() => {});
    }
  };
  const authenticateMethod = async (
    integration: IntegrationInfo,
    native: IntegrationMethod,
    channel: HarnessAuthenticationChannel,
  ) => {
    const answer = await collectFormAnswers("form" in native ? (native.form ?? []) : [], channel);
    const endpoint = `/api/integration/${encodeURIComponent(integration.id)}/connect/`;
    if (native.type === "key") {
      const key = (await channel.request({ type: "input", title: "API key", secret: true })).trim();
      if (!key) throw new Error("Enter an API key.");
      await request(`${endpoint}key`, "POST", { key, answer }, channel.signal);
      return;
    }
    if (native.type === "external") {
      await request(`${endpoint}external`, "POST", { methodID: native.id, answer }, channel.signal);
      return;
    }
    if (native.type !== "oauth" && native.type !== "command") throw new Error("Unsupported OpenCode sign-in method.");
    await connectAttempt(endpoint, native, answer, channel);
  };
  const getAuthentication = async (input: { model?: string } = {}) => state(await catalog(), input.model);
  const authenticate = async (input: HarnessAuthenticationInput, channel: HarnessAuthenticationChannel) => {
    const data = await catalog();
    channel.signal.throwIfAborted();
    const choice = await chooseHarnessAuthentication(state(data, input.model), input, channel);
    if (!choice) return;
    const provider = data.providers.find((item) => item.id === choice.provider);
    const integration = data.integrations.find((item) => item.id === provider?.integrationID);
    if (!integration) throw new Error("This provider does not require sign-in.");
    if (input.action === "logout") {
      for (const connection of integration.connections) {
        if (connection.type === "credential")
          await request(`/api/credential/${encodeURIComponent(connection.id)}`, "DELETE", undefined, channel.signal);
      }
      return;
    }
    const native = interactiveMethods(integration).find((method) => methodId(method) === choice.method);
    if (!native) throw new Error("Select an OpenCode sign-in method.");
    await authenticateMethod(integration, native, channel);
  };
  return { getAuthentication, authenticate };
};
