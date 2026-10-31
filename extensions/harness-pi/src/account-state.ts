import type { AgentSessionServices } from "@earendil-works/pi-coding-agent";
import {
  chooseHarnessAuthentication,
  type HarnessAuthentication,
  type HarnessAuthenticationChannel,
  type HarnessAuthenticationInput,
} from "@pstdio/sdk/extensions";

type Accounts = Pick<AgentSessionServices, "authStorage" | "modelRegistry">;

export const getPiAccountState = (accounts: Accounts, model?: string) => {
  const { authStorage, modelRegistry } = accounts;
  const oauth = authStorage.getOAuthProviders();
  const ids = new Set([
    ...modelRegistry.getAll().map((model) => model.provider),
    ...authStorage.list(),
    ...oauth.map((provider) => provider.id),
  ]);
  const providers = [...ids].map((id) => {
    const auth = modelRegistry.getProviderAuthStatus(id);
    const methods: HarnessAuthentication["providers"][number]["methods"] = [
      { id: "api_key", label: "API key", kind: "api_key" },
    ];
    const browser = oauth.find((provider) => provider.id === id);
    if (browser) methods.unshift({ id: "oauth", label: browser.name, kind: "oauth" });
    return {
      id,
      label: modelRegistry.getProviderDisplayName(id),
      status: auth.source ? ("signed_in" as const) : ("signed_out" as const),
      canLogout: auth.source === "stored",
      methods,
    };
  });
  const provider = model?.split("/")[0] ?? providers.find((provider) => provider.status === "signed_in")?.id;
  return {
    provider,
    status: provider ? (providers.find((item) => item.id === provider)?.status ?? "unknown") : "signed_out",
    providers,
  } satisfies HarnessAuthentication;
};

export const authenticatePiAccount = async (
  accounts: Accounts,
  input: HarnessAuthenticationInput,
  channel: HarnessAuthenticationChannel,
) => {
  const { authStorage } = accounts;
  const choice = await chooseHarnessAuthentication(getPiAccountState(accounts, input.model), input, channel);
  if (!choice) return;
  channel.signal.throwIfAborted();
  if (input.action === "logout") authStorage.logout(choice.provider);
  else if (choice.method === "api_key") {
    const key = (await channel.request({ type: "input", title: "API key", secret: true })).trim();
    channel.signal.throwIfAborted();
    if (!key) throw new Error("Enter an API key.");
    authStorage.set(choice.provider, { type: "api_key", key });
  } else {
    await authStorage.login(choice.provider, {
      signal: channel.signal,
      onAuth: (info) => {
        void channel.emit({ type: "browser", url: info.url, message: info.instructions });
      },
      onDeviceCode: (info) => {
        void channel.emit({ type: "browser", url: info.verificationUri, message: `Enter code: ${info.userCode}` });
      },
      onPrompt: (prompt) =>
        channel.request({ type: "input", title: prompt.message, placeholder: prompt.placeholder, secret: true }),
      onSelect: (prompt) => channel.request({ type: "select", title: prompt.message, options: prompt.options }),
      onManualCodeInput: () =>
        channel.request({ type: "input", title: "Paste the authorization code or callback URL", secret: true }),
      onProgress: (message) => {
        void channel.emit({ type: "message", message });
      },
    });
  }
  if (authStorage.drainErrors().length) throw new Error("Pi could not save the account change.");
};
