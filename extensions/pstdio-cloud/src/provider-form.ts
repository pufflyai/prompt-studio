import type { CloudDeviceProvider } from "@pstdio/sdk/extensions";

export const providerFormDefaults = (provider: CloudDeviceProvider) => ({
  token: "",
  region: provider.configured ? provider.region : "ams3",
  size: provider.configured ? provider.size : "s-2vcpu-4gb",
  image: provider.configured ? provider.image : "",
});
