import type { CloudDeviceProviderInput } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
export const command = "configure-cloud";
export const describe = "Save user-owned DigitalOcean configuration from a private JSON file";
export const builder = (yargs: Argv) =>
  yargs.option("file", {
    type: "string",
    demandOption: true,
    describe: "Private JSON: token, region, size, released runtime image digest",
  });
export const handler = async (args: Arguments<{ file: string }>) => {
  const config = (await Bun.file(args.file).json()) as CloudDeviceProviderInput;
  await apiClient().account.configureCloudDeviceProvider(config);
  console.log("Cloud provider configured on this device. Provider resources are billed directly to you.");
};
