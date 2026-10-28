import type { OnboardingHarness, OnboardingWorkArea } from "pstdio-api-contracts";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "onboarding <action>";
export const describe = "Choose first-launch harnesses and extensions, skip setup, or change its visibility";
export const builder = (yargs: Argv) =>
  yargs
    .positional("action", {
      choices: ["status", "harnesses", "complete", "skip", "hide", "show"] as const,
      demandOption: true,
    })
    .option("harness", { array: true, type: "string", choices: ["codex", "open-code", "claude-code", "pi"] as const })
    .option("work", { array: true, type: "string", choices: ["coding", "planning"] as const });
interface Args {
  action: "status" | "harnesses" | "complete" | "skip" | "hide" | "show";
  harness?: OnboardingHarness[];
  work?: OnboardingWorkArea[];
}
export const handler = async (argv: Arguments<Args>) => {
  const setup = apiClient().onboarding;
  if (argv.action === "status") console.log(JSON.stringify(await setup.read()));
  else if (argv.action === "harnesses")
    console.log(JSON.stringify(await setup.update({ step: "harnesses", harnesses: argv.harness ?? [] })));
  else if (argv.action === "complete")
    console.log(JSON.stringify(await setup.update({ step: "complete", workAreas: argv.work ?? [] })));
  else if (argv.action === "skip") console.log(JSON.stringify(await setup.update({ step: "skip" })));
  else console.log(JSON.stringify(await setup.update({ step: "visibility", hidden: argv.action === "hide" })));
};
