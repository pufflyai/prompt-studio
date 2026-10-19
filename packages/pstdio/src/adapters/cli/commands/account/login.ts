import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { openBrowser } from "../../dashboard/open-browser";

export const command = "login";
export const describe = "Sign in with Google in your browser; keep the owner session in the native host";
export const builder = (yargs: Argv) =>
  yargs
    .option("manager", { type: "string", demandOption: true, describe: "HTTPS account service origin" })
    .option("open-browser", { type: "boolean", default: true, describe: "Open the sign-in URL in the system browser" });
export const handler = async (args: Arguments<{ manager: string; openBrowser: boolean }>) => {
  const client = apiClient().account;
  const login = await client.login(args.manager);
  console.log(`Sign in at ${login.url}`);
  if (args.openBrowser) openBrowser(login.url);
  while (true) {
    const { status } = await client.loginStatus(login.id);
    if (status === "complete") {
      console.log("Signed in.");
      return;
    }
    if (status === "failed") throw new Error("Sign-in did not complete. Run account login again.");
    await Bun.sleep(500);
  }
};
