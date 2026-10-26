import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { openBrowser } from "../dashboard/open-browser";

export const command = "login";
export const describe = "Log in with Google and connect this device to every cloud project of your account";
export const builder = (yargs: Argv) =>
  yargs
    .option("manager", {
      type: "string",
      describe: "Override the host's account manager address (HTTPS, may include a path)",
    })
    .option("open-browser", { type: "boolean", default: true, describe: "Open the sign-in URL in the system browser" });
export const handler = async (args: Arguments<{ manager?: string; openBrowser: boolean }>) => {
  const client = apiClient().account;
  const login = await client.login(args.manager);
  console.log(`Log in at ${login.url}`);
  if (args.openBrowser) openBrowser(login.url);
  while (true) {
    const { status } = await client.loginStatus(login.id);
    if (status === "complete") {
      console.log("Logged in. This device now syncs your cloud projects.");
      return;
    }
    if (status === "failed") throw new Error("Login did not complete. Run pst login again.");
    await Bun.sleep(500);
  }
};
