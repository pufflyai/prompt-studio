import type {
  HarnessAuthentication,
  HarnessAuthenticationChannel,
  HarnessAuthenticationInput,
} from "pstdio-api-contracts";

/** Select from the native harness catalog. Environment credentials are never removable. */
export const chooseHarnessAuthentication = async (
  authentication: HarnessAuthentication,
  input: HarnessAuthenticationInput,
  channel: HarnessAuthenticationChannel,
) => {
  const providers = authentication.providers.filter((provider) =>
    input.action === "logout" ? provider.canLogout : provider.methods.length > 0,
  );
  if (
    input.action === "logout" &&
    !providers.length &&
    authentication.providers.every((provider) => provider.status === "signed_out" || provider.status === "not_required")
  )
    return null;
  if (!providers.length)
    throw new Error(
      input.action === "logout"
        ? "Credentials are managed outside this harness."
        : "This harness has no interactive sign-in method.",
    );
  let providerId = input.provider;
  if (!providerId)
    providerId =
      providers.length === 1
        ? providers[0]!.id
        : await channel.request({
            type: "select",
            title: "Choose a provider",
            initial: authentication.provider,
            options: providers.map((provider) => ({ id: provider.id, label: provider.label })),
          });
  const provider = providers.find((provider) => provider.id === providerId);
  if (!provider) throw new Error("Select an available provider.");
  if (input.action === "logout") return { provider: provider.id };
  let methodId = input.method;
  if (!methodId)
    methodId =
      provider.methods.length === 1 && providers.length === 1
        ? provider.methods[0]!.id
        : await channel.request({
            type: "select",
            title: `Sign in to ${provider.label}`,
            options: provider.methods,
          });
  const method = provider.methods.find((method) => method.id === methodId);
  if (!method) throw new Error("Select an available sign-in method.");
  return { provider: provider.id, method: method.id };
};
