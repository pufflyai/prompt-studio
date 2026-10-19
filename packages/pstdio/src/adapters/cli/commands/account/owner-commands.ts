import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const ownerOptions = (yargs: Argv) =>
  yargs
    .option("manager", { type: "string", demandOption: true, describe: "HTTPS account service origin" })
    .option("account", {
      type: "string",
      demandOption: true,
      describe: "Account ID from account status or account create",
    });
const managerOptions = (yargs: Argv) =>
  yargs.option("manager", { type: "string", demandOption: true, describe: "HTTPS account service origin" });
const print = (value: unknown) => console.log(JSON.stringify(value));
export const statusCommand = {
  command: "status",
  describe: "Inspect the signed-in owner, accounts and connected workbenches",
  builder: managerOptions,
  handler: async (args: Arguments<{ manager: string }>) => print(await apiClient().account.inspect(args.manager)),
};
export const createCommand = {
  command: "create",
  describe: "Create this Google owner's account, or return its existing identity",
  builder: managerOptions,
  handler: async (args: Arguments<{ manager: string }>) => print(await apiClient().account.create(args.manager)),
};
export const signOutCommand = {
  command: "sign-out",
  describe: "Sign out the owner session; enrolled environments retain their own authority",
  builder: managerOptions,
  handler: async (args: Arguments<{ manager: string }>) => print(await apiClient().account.signOut(args.manager)),
};
export const workbenchesCommand = {
  command: "workbenches",
  describe: "List this account's workbench identities",
  builder: ownerOptions,
  handler: async (args: Arguments<{ manager: string; account: string }>) =>
    print(await apiClient().account.workbenches(args.manager, args.account)),
};
export const environmentsCommand = {
  command: "environments",
  describe: "List this account's enrolled environments without credentials",
  builder: ownerOptions,
  handler: async (args: Arguments<{ manager: string; account: string }>) =>
    print(await apiClient().account.environments(args.manager, args.account)),
};
export const revokeCommand = {
  command: "revoke <environment>",
  describe: "Revoke future renewal for an environment across this account's workbenches",
  builder: (yargs: Argv) => ownerOptions(yargs).positional("environment", { type: "string", demandOption: true }),
  handler: async (args: Arguments<{ manager: string; account: string; environment: string }>) =>
    print(await apiClient().account.revoke(args.manager, args.account, args.environment)),
};
