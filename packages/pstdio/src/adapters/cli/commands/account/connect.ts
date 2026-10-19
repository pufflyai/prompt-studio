import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { ownerOptions } from "./owner-commands";

export const command = "connect <workbench>";
export const describe = "Add synchronization to an existing locally created or bound workbench";
export const builder = (yargs: Argv) =>
  ownerOptions(yargs)
    .positional("workbench", { type: "string", demandOption: true, describe: "Stable project/workbench ID" })
    .option("expires-at", {
      type: "string",
      demandOption: true,
      describe: "Finite environment grant expiry as an ISO UTC timestamp",
    });
export const handler = async (
  args: Arguments<{ manager: string; account: string; workbench: string; expiresAt: string }>,
) => {
  console.log(
    JSON.stringify(
      await apiClient().account.connect(args.workbench, {
        managerOrigin: args.manager,
        accountId: args.account,
        expiresAt: args.expiresAt,
      }),
    ),
  );
};
