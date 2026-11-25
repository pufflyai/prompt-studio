import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { openBrowser } from "../dashboard/open-browser";

export const command = "login";
export const describe = "Sign in to Prompt Studio Cloud and connect this device";
export const builder = (yargs: Argv) =>
  yargs
    .option("manager", {
      type: "string",
      describe: "Override the host's account manager address (HTTPS, may include a path)",
    })
    .option("provider", { choices: ["google", "microsoft"] as const, describe: "Sign-in provider (default: Google)" })
    .option("open-browser", { type: "boolean", default: true, describe: "Open the sign-in URL in the system browser" });
export const handler = async (
  args: Arguments<{ manager?: string; provider?: "google" | "microsoft"; openBrowser: boolean }>,
) => {
  const client = apiClient().account;
  const login = await client.login(args.manager, args.provider);
  console.log(`Log in at ${login.url}`);
  if (args.openBrowser) openBrowser(login.url);
  while (true) {
    const { status, error } = await client.loginStatus(login.id);
    if (status === "complete") {
      console.log("Logged in. This device now syncs your cloud projects.");
      return;
    }
    if (status === "failed") {
      if (error === "provider-unavailable")
        throw new Error("This account manager has not enabled that sign-in provider.");
      if (error === "provider-denied")
        throw new Error("Sign-in was declined. Check your provider's consent policy and retry.");
      throw new Error("Sign-in did not complete. Run pst login again.");
    }
    await Bun.sleep(500);
  }
};
